import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { RecommendInput } from '@sipclock/domain';
import { flavor, glass, method, occasion } from '@sipclock/domain';
import { PROBLEM_CONTENT_TYPE, problemResponse, problemSchema } from '../lib/errors.ts';
import { validationHook } from '../middleware/error-handling.ts';
import type { RecommendationService } from '../services/recommendations.ts';
import type { AppEnv } from '../types.ts';

const momentSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  weekday: z.number().int().min(0).max(6).meta({ description: '0 = Sunday … 6 = Saturday' }),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  hemisphere: z.enum(['north', 'south']),
});

const idSchema = z.string().min(1).max(64);

export const recommendBodySchema = z
  .object({
    moment: momentSchema,
    occasion: occasion.optional(),
    weather: z
      .object({
        tempC: z.number().min(-90).max(60),
        condition: z.enum(['clear', 'cloudy', 'rain', 'snow']),
      })
      .nullable()
      .default(null),
    bar: z
      .array(idSchema)
      .max(300)
      .nullable()
      .default(null)
      .meta({ description: 'Ingredient ids at home; null = unknown (availability not scored).' }),
    taste: z
      .object({
        flavors: z.array(flavor).max(10),
        strength: z.enum(['zero', 'light', 'medium', 'strong']).optional(),
      })
      .optional(),
    alcoholFree: z.boolean().optional(),
    recent: z
      .array(idSchema)
      .max(50)
      .optional()
      .meta({ description: 'Recipe ids shown recently, most recent first.' }),
    seed: z
      .number()
      .int()
      .min(0)
      .max(2 ** 31 - 1),
    alternatives: z.number().int().min(0).max(10).optional(),
  })
  .meta({ id: 'RecommendRequest' });

const reasonSchema = z.union([
  z.object({ code: z.literal('daypart'), daypart: z.string() }),
  z.object({ code: z.literal('weekend') }),
  z.object({ code: z.literal('weather'), fit: z.enum(['hot', 'cold', 'rainy']) }),
  z.object({ code: z.literal('season'), season: z.enum(['spring', 'summer', 'autumn', 'winter']) }),
  z.object({ code: z.literal('occasion'), occasion }),
  z.object({ code: z.literal('taste'), flavors: z.array(flavor) }),
  z.object({ code: z.literal('in-bar'), ingredients: z.array(z.string()) }),
  z.object({ code: z.literal('swap'), need: z.string(), use: z.string() }),
  z.object({ code: z.literal('missing'), ingredients: z.array(z.string()) }),
  z.object({ code: z.literal('alcohol-free') }),
]);

const swapSchema = z.object({ need: z.string(), use: z.string() });

const availabilitySchema = z.union([
  z.object({ status: z.literal('ready') }),
  z.object({ status: z.literal('swap'), swaps: z.array(swapSchema) }),
  z.object({
    status: z.literal('missing'),
    missing: z.array(z.string()),
    swaps: z.array(swapSchema),
  }),
  z.object({ status: z.literal('unknown') }),
]);

const scoredSchema = z
  .object({
    recipeId: z.string(),
    score: z.number(),
    abv: z.number().meta({ description: 'Estimated ABV of the finished drink, percent.' }),
    availability: availabilitySchema,
    reasons: z.array(reasonSchema),
  })
  .meta({ id: 'ScoredRecipe' });

const recommendResponseSchema = z
  .object({
    pick: scoredSchema.nullable(),
    alternatives: z.array(scoredSchema),
    catalogVersion: z.string(),
    rulesVersion: z.string(),
    recipes: z.array(
      z.object({
        id: z.string(),
        name: z.object({ en: z.string(), ru: z.string() }),
        glass,
        method,
      }),
    ),
  })
  .meta({ id: 'Recommendation' });

const recommendRoute = createRoute({
  method: 'post',
  path: '/v1/recommendations',
  tags: ['recommendations'],
  summary: 'Pick a cocktail for a moment, with alternatives',
  description: 'Deterministic for a given input and seed. Never cached.',
  request: {
    body: { required: true, content: { 'application/json': { schema: recommendBodySchema } } },
  },
  responses: {
    200: {
      description: 'Recommendation with minimal embedded recipe data',
      content: { 'application/json': { schema: recommendResponseSchema } },
    },
    400: {
      description: 'Invalid body or unknown ingredient/recipe ids',
      content: { [PROBLEM_CONTENT_TYPE]: { schema: problemSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { [PROBLEM_CONTENT_TYPE]: { schema: problemSchema } },
    },
  },
});

type Body = z.infer<typeof recommendBodySchema>;

/** Drops `undefined` optionals (exactOptionalPropertyTypes) and maps the body to the engine input. */
function toInput(body: Body): RecommendInput {
  return {
    moment: body.moment,
    weather: body.weather,
    bar: body.bar,
    seed: body.seed,
    ...(body.occasion === undefined ? {} : { occasion: body.occasion }),
    ...(body.taste === undefined
      ? {}
      : {
          taste: {
            flavors: body.taste.flavors,
            ...(body.taste.strength === undefined ? {} : { strength: body.taste.strength }),
          },
        }),
    ...(body.alcoholFree === undefined ? {} : { alcoholFree: body.alcoholFree }),
    ...(body.recent === undefined ? {} : { recent: body.recent }),
    ...(body.alternatives === undefined ? {} : { alternatives: body.alternatives }),
  };
}

export function createRecommendationsRouter(deps: { recommendations: RecommendationService }) {
  const router = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });

  router.openapi(recommendRoute, (c) => {
    const input = toInput(c.req.valid('json'));
    const unknown = deps.recommendations.findUnknownIds(input);
    if (unknown.length > 0) {
      return problemResponse({
        type: 'https://sipclock.app/problems/unknown-ids',
        title: 'Bad Request',
        status: 400,
        detail: `Unknown ids: ${unknown.map((u) => u.id).join(', ')}`,
        instance: c.req.path,
        requestId: c.get('requestId'),
        errors: unknown.map((u) => ({
          field: u.field,
          message: `Unknown ${u.field.startsWith('bar') ? 'ingredient' : 'recipe'} id "${u.id}"`,
          code: 'unknown_id',
        })),
      }) as never;
    }
    c.header('Cache-Control', 'no-store');
    return c.json(deps.recommendations.recommend(input), 200);
  });

  return router;
}
