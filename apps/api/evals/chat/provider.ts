// promptfoo provider for the Bartender chat: the real instructions, tools, step limit and brand mask, called
// with the same streamText settings as POST /v1/ai/chat, minus the gateway (quota and budget do not apply).
import { createIndex } from '@sipclock/engine';
import { simulateStreamingMiddleware, stepCountIs, streamText, wrapLanguageModel } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import type {
  ApiProvider,
  CallApiContextParams,
  ProviderOptions,
  ProviderResponse,
} from 'promptfoo';
import { createModelRegistry } from '../../src/ai/providers.ts';
import { parseEnv } from '../../src/env.ts';
import { createBundledCatalogService } from '../../src/services/catalog.ts';
import {
  brandMaskTransform,
  chatInstructions,
  createBrandMasker,
  createChatToolFactory,
  MAX_STEP_OUTPUT_TOKENS,
  MAX_STEPS,
  momentFrom,
  toModelMessages,
} from '../../src/services/chat.ts';

export const DEFAULT_BAR = [
  'gin',
  'lemon',
  'simple-syrup',
  'soda-water',
  'tonic-water',
  'red-bitter-aperitif',
  'sugar',
  'honey',
  'bourbon',
  'aromatic-bitters',
];
const CLIENT_TIME = '2026-10-02T19:00:00+03:00';

/** Calls what_can_i_make once, then answers in the case's language. */
function mockModel() {
  const usage = {
    inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 30, text: 30, reasoning: undefined },
  };
  return new MockLanguageModelV4({
    doStream: async (options) => {
      const text = JSON.stringify(options.prompt);
      const afterTool = options.prompt.some((m) => m.role === 'tool');
      const ru = text.includes('Russian');
      const parts = afterTool
        ? [
            { type: 'text-start' as const, id: 't' },
            {
              type: 'text-delta' as const,
              id: 't',
              delta: ru ? 'Вот что можно приготовить.' : 'Here is what you can make.',
            },
            { type: 'text-end' as const, id: 't' },
          ]
        : [
            {
              type: 'tool-call' as const,
              toolCallId: 'c1',
              toolName: 'what_can_i_make',
              input: '{}',
            },
          ];
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            for (const p of parts) controller.enqueue(p);
            controller.enqueue({
              type: 'finish',
              finishReason: { unified: afterTool ? 'stop' : 'tool-calls', raw: undefined },
              usage,
            });
            controller.close();
          },
        }),
      };
    },
  });
}

export default class ChatProvider implements ApiProvider {
  readonly config: { model?: string };
  readonly label: string;

  constructor(options: ProviderOptions = {}) {
    this.config = (options.config ?? {}) as { model?: string };
    this.label = options.label ?? `sipclock-chat:${this.config.model ?? 'default'}`;
  }

  id(): string {
    return this.label;
  }

  async callApi(_prompt: string, context?: CallApiContextParams): Promise<ProviderResponse> {
    const vars = (context?.vars ?? {}) as Record<string, unknown>;
    const question = String(vars.question ?? '');
    const locale = vars.locale === 'ru' ? 'ru' : 'en';
    const bar = Array.isArray(vars.bar) ? vars.bar.map(String) : DEFAULT_BAR;

    const mock = process.env.EVALS_MOCK === '1';
    const env = { ...parseEnv() };
    if (this.config.model) env.YANDEX_MODEL = this.config.model;
    if (!mock && !(env.YANDEX_API_KEY && env.YANDEX_FOLDER_ID)) {
      return { error: 'YANDEX_API_KEY / YANDEX_FOLDER_ID not set' };
    }
    const model = mock ? mockModel() : createModelRegistry(env).get('yandex')?.model;
    if (!model) return { error: 'no model configured' };

    const catalog = createBundledCatalogService(process.env.CATALOG_DIR);
    const index = createIndex(catalog.catalog);
    const tools = createChatToolFactory({
      catalog,
      userData: { snapshot: async () => ({ bar, favorites: [], history: [] }) },
    })({ userId: 'eval', locale, moment: momentFrom(CLIENT_TIME, new Date()) });

    const calls: string[] = [];
    const recipes: string[] = [];
    let text = '';
    let failure: string | undefined;
    try {
      const result = streamText({
        // As in the route: whole steps replayed as a stream (Yandex breaks on streamed parallel tool calls).
        model: wrapLanguageModel({ model, middleware: simulateStreamingMiddleware() }),
        instructions: chatInstructions(locale),
        messages: toModelMessages([{ role: 'user', text: question }]),
        tools,
        stopWhen: stepCountIs(MAX_STEPS),
        maxOutputTokens: MAX_STEP_OUTPUT_TOKENS,
        temperature: 0.3,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(60_000),
        experimental_transform: brandMaskTransform(createBrandMasker(index, locale)),
        onError: ({ error }) => {
          failure = error instanceof Error ? error.message : String(error);
        },
      });
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') text += part.text;
        else if (part.type === 'tool-call') calls.push(part.toolName);
        else if (part.type === 'tool-result') {
          const out = part.output as { recipes?: { id: string }[] } | undefined;
          for (const r of out?.recipes ?? []) if (!recipes.includes(r.id)) recipes.push(r.id);
        }
      }
      if (failure) return { error: failure };
      const usage = await result.totalUsage;
      return {
        output: JSON.stringify({ tools: calls, recipes, text: text.trim() }),
        tokenUsage: {
          prompt: usage.inputTokens ?? 0,
          completion: usage.outputTokens ?? 0,
          total: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
        },
        metadata: { locale, model: this.config.model ?? 'default', mock },
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
}
