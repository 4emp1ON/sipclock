import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { PROBLEM_CONTENT_TYPE, problemSchema } from '../lib/errors.ts';
import { validationHook } from '../middleware/error-handling.ts';
import type { SearchService } from '../services/search.ts';
import type { AppEnv } from '../types.ts';

const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).meta({ description: 'Words, an ingredient or a mood.' }),
  locale: z.enum(['en', 'ru']).default('en'),
  limit: z.coerce.number().int().min(1).max(30).default(20),
});

const searchResponseSchema = z
  .object({
    query: z.string(),
    semantic: z.boolean().meta({
      description:
        'Semantic similarity took part; false = lexical only (no provider, budget, timeout).',
    }),
    results: z.array(
      z.object({
        id: z.string(),
        score: z.number(),
        field: z.enum(['name', 'ingredient', 'tag', 'description', 'meaning']).meta({
          description: 'Where the query matched; `meaning` = found by semantic similarity only.',
        }),
      }),
    ),
  })
  .meta({ id: 'SearchResults' });

const searchRoute = createRoute({
  method: 'get',
  path: '/v1/search',
  tags: ['catalog'],
  summary: 'Search recipes',
  description:
    'Hybrid recipe search: words in names, ingredients, tags and descriptions (EN and RU), fused with ' +
    'semantic similarity of the query to each recipe. Public; limited per IP.',
  request: { query: searchQuerySchema },
  responses: {
    200: {
      description: 'Recipe ids, best first',
      content: { 'application/json': { schema: searchResponseSchema } },
    },
    400: {
      description: 'Invalid query',
      content: { [PROBLEM_CONTENT_TYPE]: { schema: problemSchema } },
    },
    429: {
      description: 'Rate limit exceeded',
      content: { [PROBLEM_CONTENT_TYPE]: { schema: problemSchema } },
    },
  },
});

export function createSearchRouter(deps: { search: SearchService }) {
  const router = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });
  router.openapi(searchRoute, async (c) => {
    const { q, limit } = c.req.valid('query');
    const answer = await deps.search.search(q, limit);
    // Same query, same catalog, same answer: browsers may reuse it for a few minutes.
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({ query: q, ...answer }, 200);
  });
  return router;
}
