import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  type LanguageModelUsage,
  type StepResult,
  simulateStreamingMiddleware,
  stepCountIs,
  streamText,
  type ToolSet,
  wrapLanguageModel,
} from 'ai';
import type { Context } from 'hono';
import type { AiCaller, AiGateway, TokenUsage } from '../ai/gateway.ts';
import { PROBLEM_CONTENT_TYPE, problemResponse, problemSchema, titleFor } from '../lib/errors.ts';
import type { Logger } from '../lib/logger.ts';
import { validationHook } from '../middleware/error-handling.ts';
import {
  brandMaskTransform,
  type ChatContext,
  chatInstructions,
  MAX_STEP_OUTPUT_TOKENS,
  MAX_STEPS,
  momentFrom,
  toModelMessages,
} from '../services/chat.ts';
import type { Locale, SubstitutesService } from '../services/substitutes.ts';
import type { AppEnv } from '../types.ts';

/** AI requests left today; absent when the gateway was not consulted (cache hit, nothing to rank, AI off). */
export const QUOTA_HEADER = 'X-AI-Quota-Remaining';

const problem = (description: string) => ({
  description,
  content: { [PROBLEM_CONTENT_TYPE]: { schema: problemSchema } },
});

const idSchema = z.string().min(1).max(64);

const substitutesBodySchema = z
  .object({
    recipeId: idSchema,
    ingredientId: idSchema.meta({
      description: 'The ingredient the user lacks; must be in the recipe.',
    }),
    bar: z
      .array(idSchema)
      .max(300)
      .default([])
      .meta({ description: 'Ingredient ids at home; unknown ids are ignored.' }),
    locale: z.enum(['en', 'ru']),
  })
  .meta({ id: 'SubstitutesRequest' });

const substitutesResponseSchema = z
  .object({
    recipeId: z.string(),
    ingredientId: z.string(),
    source: z.enum(['ai', 'catalog']).meta({
      description: '`catalog` when no model answered (quota, outage, nothing to rank).',
    }),
    suggestions: z.array(
      z.object({
        ingredientId: z.string(),
        inBar: z.boolean(),
        fit: z.enum(['close', 'workable']),
        note: z.string().optional(),
      }),
    ),
    canSkip: z.boolean(),
  })
  .meta({ id: 'Substitutes' });

const substitutesRoute = createRoute({
  method: 'post',
  path: '/v1/ai/substitutes',
  tags: ['ai'],
  summary: 'Substitutes for an ingredient the user lacks',
  description:
    'Candidates come from the catalog (curated substitutes, related ingredients, the bar); a model ranks ' +
    'and explains them. Counts against the daily AI quota unless answered from the cache or the catalog.',
  request: {
    body: { required: true, content: { 'application/json': { schema: substitutesBodySchema } } },
  },
  responses: {
    200: {
      description: 'Suggestions, best first',
      content: { 'application/json': { schema: substitutesResponseSchema } },
      headers: z.object({
        [QUOTA_HEADER]: z.string().optional().meta({ description: 'AI requests left today.' }),
      }),
    },
    400: problem('Invalid body or the ingredient is not in the recipe'),
    401: problem('Not signed in'),
    404: problem('Unknown recipe'),
    429: problem('Rate limit exceeded'),
  },
});

export const MAX_CHAT_LINES = 20;
export const MAX_CHAT_LINE_CHARS = 2000;
export const MAX_CHAT_QUESTION_CHARS = 500;
/** An answer that takes longer is cut off (the web proxy waits 60 s). */
const CHAT_TIMEOUT_MS = 55_000;

const chatBodySchema = z
  .object({
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          text: z.string().trim().min(1).max(MAX_CHAT_LINE_CHARS),
        }),
      )
      .min(1)
      .max(MAX_CHAT_LINES)
      .refine((m) => m.at(-1)?.role === 'user', 'The last message must be from the user.')
      .refine(
        (m) => (m.at(-1)?.text.length ?? 0) <= MAX_CHAT_QUESTION_CHARS,
        `The question is longer than ${MAX_CHAT_QUESTION_CHARS} characters.`,
      )
      .meta({ description: 'The conversation, oldest first: plain text only, no tool results.' }),
    locale: z.enum(['en', 'ru']),
    clientTime: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
      .max(40)
      .meta({ description: "The user's local time, ISO 8601 with offset." }),
  })
  .meta({ id: 'ChatRequest' });

const chatRecipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  abv: z.number(),
  status: z.enum(['ready', 'swap', 'missing', 'unknown']),
  missing: z.array(z.string()),
});

const chatAnswerSchema = z
  .object({
    text: z.string(),
    tools: z
      .array(z.object({ tool: z.string(), recipes: z.array(chatRecipeSchema) }))
      .meta({ description: 'Tool calls in order, with the recipes each returned.' }),
  })
  .meta({ id: 'ChatAnswer' });

/** JSON instead of a stream: the client asked for JSON and not for server-sent events. */
const wantsJson = (accept: string | undefined) =>
  accept?.includes('application/json') === true && !accept.includes('text/event-stream');

const chatRoute = createRoute({
  method: 'post',
  path: '/v1/ai/chat',
  tags: ['ai'],
  summary: 'Ask the bartender',
  description:
    'Streams an answer as an AI SDK UI message stream. The model reads the catalog and the bar through ' +
    'read-only tools. Counts one request against the daily AI quota.',
  request: {
    body: { required: true, content: { 'application/json': { schema: chatBodySchema } } },
  },
  responses: {
    200: {
      description:
        'UI message stream (server-sent events); the whole answer as JSON when the request accepts ' +
        '`application/json` and not `text/event-stream` (clients without streaming fetch).',
      content: {
        'text/event-stream': { schema: z.string() },
        'application/json': { schema: chatAnswerSchema },
      },
      headers: z.object({
        [QUOTA_HEADER]: z.string().meta({ description: 'AI requests left today.' }),
      }),
    },
    400: problem('Invalid body'),
    401: problem('Not signed in'),
    409: problem('Another answer for this user is still streaming'),
    429: problem('Daily AI quota used up (with `X-AI-Quota-Remaining: 0`) or rate limited'),
    503: problem('AI is unavailable'),
  },
});

export interface ChatDeps {
  gateway: AiGateway;
  tools: (ctx: ChatContext) => ToolSet;
  masker: (locale: Locale) => (text: string) => string;
  logger: Logger;
  now?: () => Date;
}

/**
 * Usage to charge for an interrupted answer: what the finished steps used, but never less than the
 * reservation, since the step in flight was already sent and is billed by the provider all the same.
 */
export function abortedUsage(
  steps: readonly StepResult<ToolSet>[],
  reserved: { inputTokens: number; maxOutputTokens: number },
): TokenUsage {
  const sum = (pick: (s: StepResult<ToolSet>) => number | undefined) =>
    steps.reduce((n, s) => n + (pick(s) ?? 0), 0);
  return {
    inputTokens: Math.max(
      sum((s) => s.usage.inputTokens),
      reserved.inputTokens,
    ),
    outputTokens: Math.max(
      sum((s) => s.usage.outputTokens),
      reserved.maxOutputTokens,
    ),
  };
}
const usageOf = (u: LanguageModelUsage): TokenUsage => ({
  inputTokens: u.inputTokens,
  outputTokens: u.outputTokens,
});

/** Routes under `/v1/ai`; expects `requireSession` to have set `userId`. */
export function createAiRouter(deps: {
  substitutes: SubstitutesService;
  caller: (c: Context<AppEnv>, locale: string | undefined) => AiCaller;
  chat?: ChatDeps;
}) {
  const router = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });
  // One streaming answer per user at a time (a single API instance; see deploy/sipclock). The value tells
  // requests apart, so only the one holding the lock releases it.
  const answering = new Map<string, symbol>();

  const fail = (c: Context<AppEnv>, status: 409 | 429 | 503, detail: string) =>
    problemResponse({
      type: 'about:blank',
      title: titleFor(status),
      status,
      detail,
      instance: c.req.path,
      requestId: c.get('requestId'),
    }) as never;

  const { chat } = deps;
  if (chat) {
    router.openapi(chatRoute, async (c) => {
      const body = c.req.valid('json');
      const userId = c.get('userId');
      if (answering.has(userId)) return fail(c, 409, 'Still answering your last question.');
      // Taken before any await, so two parallel requests cannot both pass the check.
      const lock = Symbol(userId);
      answering.set(userId, lock);
      const unlock = () => {
        if (answering.get(userId) === lock) answering.delete(userId);
      };

      const caller = deps.caller(c, body.locale);
      const chars = body.messages.reduce((n, m) => n + m.text.length, 0);
      // Every step resends the conversation and tool results; the reservation is settled to the real usage.
      const estimate = {
        inputTokens: (Math.ceil(chars / 3) + 1500) * 3,
        maxOutputTokens: MAX_STEP_OUTPUT_TOKENS * 2,
      };
      let opened: Awaited<ReturnType<AiGateway['open']>>;
      try {
        opened = await chat.gateway.open(caller, 'chat', estimate);
      } catch (error) {
        unlock();
        throw error;
      }
      if (!opened.ok) {
        unlock();
        if (opened.reason === 'quota') {
          c.header(QUOTA_HEADER, '0');
          return fail(c, 429, 'The daily AI limit is used up.');
        }
        return fail(c, 503, 'The bartender is unavailable right now.');
      }

      const { lease } = opened;
      const finish = async (usage: TokenUsage | undefined, error?: unknown) => {
        unlock();
        await lease.settle(usage, error);
      };
      const now = chat.now?.() ?? new Date();
      let result: ReturnType<typeof streamText>;
      try {
        result = streamText({
          // Each step is fetched whole and replayed as a stream: Yandex's streaming breaks off when a model
          // calls two tools at once (docs/adr/0008), and the text of one step is short anyway.
          model: wrapLanguageModel({
            model: lease.model.model,
            middleware: simulateStreamingMiddleware(),
          }),
          instructions: chatInstructions(body.locale),
          messages: toModelMessages(body.messages),
          tools: chat.tools({
            userId,
            locale: body.locale,
            moment: momentFrom(body.clientTime, now),
          }),
          stopWhen: stepCountIs(MAX_STEPS),
          maxOutputTokens: MAX_STEP_OUTPUT_TOKENS,
          temperature: 0.3,
          maxRetries: 0,
          abortSignal: AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(CHAT_TIMEOUT_MS)]),
          experimental_transform: brandMaskTransform(chat.masker(body.locale)),
          onEnd: ({ totalUsage }) => finish(usageOf(totalUsage)),
          onAbort: ({ steps }) => finish(abortedUsage(steps, estimate), new Error('aborted')),
          // Charges the whole reservation: an error may come after the provider billed the step.
          onError: ({ error }) => finish(undefined, error),
        });
      } catch (error) {
        await finish(undefined, error);
        throw error;
      }
      if (wantsJson(c.req.header('accept'))) {
        // Errors and aborts are settled by the callbacks above; here they only mean "no answer".
        await result.consumeStream({ onError: () => {} });
        let text = '';
        let tools: { tool: string; recipes: unknown[] }[] = [];
        try {
          const steps = await result.steps;
          text = (await result.text).trim();
          tools = steps.flatMap((step) =>
            step.toolResults.map((r) => {
              const out = r.output as { recipes?: unknown } | undefined;
              return { tool: r.toolName, recipes: Array.isArray(out?.recipes) ? out.recipes : [] };
            }),
          );
        } catch {
          text = '';
        }
        if (!text) return fail(c, 503, 'The bartender could not answer.');
        c.header(QUOTA_HEADER, String(lease.remaining));
        c.header('Cache-Control', 'no-store');
        return c.json({ text, tools }, 200) as never;
      }
      return result.toUIMessageStreamResponse({
        headers: { [QUOTA_HEADER]: String(lease.remaining), 'Cache-Control': 'no-store' },
        onError: (error) => {
          chat.logger.warn('chat stream error', {
            requestId: caller.requestId,
            error: error instanceof Error ? error.message : String(error),
          });
          return 'The bartender could not answer.';
        },
      }) as never;
    });
  }

  router.openapi(substitutesRoute, async (c) => {
    const body = c.req.valid('json');
    const outcome = await deps.substitutes.suggest(body, deps.caller(c, body.locale));
    if (!outcome.ok) {
      const status = outcome.error === 'unknown-recipe' ? 404 : 400;
      return problemResponse({
        type: 'about:blank',
        title: titleFor(status),
        status,
        detail:
          outcome.error === 'unknown-recipe'
            ? `Unknown recipe "${body.recipeId}"`
            : `"${body.ingredientId}" is not an ingredient of "${body.recipeId}"`,
        instance: c.req.path,
        requestId: c.get('requestId'),
      }) as never;
    }
    c.header('Cache-Control', 'no-store');
    if (outcome.remaining !== null) c.header(QUOTA_HEADER, String(outcome.remaining));
    return c.json(outcome.result, 200);
  });

  return router;
}
