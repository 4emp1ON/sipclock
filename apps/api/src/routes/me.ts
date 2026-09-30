import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { changeBatchSchema, MAX_CHANGE_OPS } from '@sipclock/domain';
import { PROBLEM_CONTENT_TYPE, problemSchema } from '../lib/errors.ts';
import { validationHook } from '../middleware/error-handling.ts';
import type { UserDataService } from '../services/user-data.ts';
import type { AppEnv } from '../types.ts';

const problem = (description: string) => ({
  description,
  content: { [PROBLEM_CONTENT_TYPE]: { schema: problemSchema } },
});

const changeResultSchema = z
  .object({
    applied: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative().meta({
      description: 'Ops that lost last-writer-wins, referenced unknown ids or had no data.',
    }),
  })
  .meta({ id: 'ChangeResult' });

const snapshotSchema = z
  .object({
    bar: z
      .array(z.string())
      .meta({ description: 'Ingredient ids in the bar, oldest change first.' }),
    favorites: z
      .array(z.string())
      .meta({ description: 'Favorite recipe ids, oldest change first.' }),
    history: z
      .array(
        z.object({
          id: z.uuid(),
          recipeId: z.string(),
          madeAt: z.number().int().meta({ description: 'Epoch ms.' }),
        }),
      )
      .meta({ description: 'Newest first, at most 200 entries.' }),
  })
  .meta({ id: 'UserDataSnapshot' });

const changesRoute = createRoute({
  method: 'post',
  path: '/v1/me/changes',
  tags: ['me'],
  summary: "Apply changes to the signed-in user's data",
  description:
    `Up to ${MAX_CHANGE_OPS} ops, applied in one transaction. Conflicts: last writer wins per row by ` +
    'the client clock `updated_at`; clocks more than 5 minutes ahead of the server are clamped. A ' +
    'retried request with the same `Idempotency-Key` returns the stored result without re-applying.',
  request: {
    headers: z.object({
      'idempotency-key': z
        .string()
        .min(1)
        .max(128)
        .meta({ description: 'Unique per logical request; reuse it when retrying.' }),
    }),
    body: {
      required: true,
      content: { 'application/json': { schema: changeBatchSchema.meta({ id: 'ChangeBatch' }) } },
    },
  },
  responses: {
    200: {
      description: 'Result, or the stored result of an earlier request with the same key',
      content: { 'application/json': { schema: changeResultSchema } },
    },
    400: problem('Invalid body or missing Idempotency-Key'),
    401: problem('Not signed in'),
    413: problem('Body too large'),
    415: problem('Body is not JSON'),
    429: problem('Rate limit exceeded'),
  },
});

const dataRoute = createRoute({
  method: 'get',
  path: '/v1/me/data',
  tags: ['me'],
  summary: "The signed-in user's bar, favorites and drink history",
  responses: {
    200: {
      description: 'Current state; removed items are excluded',
      content: { 'application/json': { schema: snapshotSchema } },
    },
    401: problem('Not signed in'),
    429: problem('Rate limit exceeded'),
  },
});

/** Routes under `/v1/me`; expects `requireSession` to have set `userId`. */
export function createMeRouter(deps: { userData: UserDataService }) {
  const router = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });

  router.openapi(changesRoute, async (c) => {
    const result = await deps.userData.applyChanges(
      c.get('userId'),
      c.req.valid('header')['idempotency-key'],
      c.req.valid('json'),
    );
    c.header('Cache-Control', 'no-store');
    return c.json(result, 200);
  });

  router.openapi(dataRoute, async (c) => {
    const snapshot = await deps.userData.snapshot(c.get('userId'));
    c.header('Cache-Control', 'no-store');
    return c.json(snapshot, 200);
  });

  return router;
}
