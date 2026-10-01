import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { AiCaller } from '../ai/gateway.ts';
import { PROBLEM_CONTENT_TYPE, problemResponse, problemSchema, titleFor } from '../lib/errors.ts';
import { validationHook } from '../middleware/error-handling.ts';
import type { SubstitutesService } from '../services/substitutes.ts';
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

/** Routes under `/v1/ai`; expects `requireSession` to have set `userId`. */
export function createAiRouter(deps: {
  substitutes: SubstitutesService;
  caller: (c: Context<AppEnv>, locale: string | undefined) => AiCaller;
}) {
  const router = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });

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
