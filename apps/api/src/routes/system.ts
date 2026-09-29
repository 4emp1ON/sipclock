import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { PROBLEM_CONTENT_TYPE, problemResponse, problemSchema } from '../lib/errors.ts';
import { validationHook } from '../middleware/error-handling.ts';
import type { HealthService } from '../services/health.ts';
import type { MetaService } from '../services/meta.ts';
import type { AppEnv } from '../types.ts';

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['system'],
  summary: 'Liveness probe (does not touch the database)',
  responses: {
    200: {
      description: 'Process is alive',
      content: {
        'application/json': {
          schema: z.object({ status: z.literal('ok') }).meta({ id: 'Health' }),
        },
      },
    },
  },
});

const readyRoute = createRoute({
  method: 'get',
  path: '/ready',
  tags: ['system'],
  summary: 'Readiness probe (pings the database)',
  responses: {
    200: {
      description: 'Ready to serve traffic',
      content: {
        'application/json': {
          schema: z.object({ status: z.literal('ready') }).meta({ id: 'Ready' }),
        },
      },
    },
    503: {
      description: 'Database unavailable',
      content: { [PROBLEM_CONTENT_TYPE]: { schema: problemSchema } },
    },
  },
});

const metaRoute = createRoute({
  method: 'get',
  path: '/v1/meta',
  tags: ['meta'],
  summary: 'API and catalog metadata',
  responses: {
    200: {
      description: 'Metadata',
      content: {
        'application/json': {
          schema: z
            .object({
              apiVersion: z.string().meta({ example: '1' }),
              catalogVersion: z.string().nullable(),
              time: z.iso.datetime(),
            })
            .meta({ id: 'Meta' }),
        },
      },
    },
  },
});

export function createSystemRouter(deps: { health: HealthService; meta: MetaService }) {
  const router = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });

  router.openapi(healthRoute, (c) => c.json({ status: 'ok' as const }, 200));

  router.openapi(readyRoute, async (c) => {
    if (await deps.health.isReady()) return c.json({ status: 'ready' as const }, 200);
    return problemResponse({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      detail: 'Database is not reachable',
      instance: c.req.path,
      requestId: c.get('requestId'),
    }) as never; // problem+json isn't in the typed-response union for c.json
  });

  router.openapi(metaRoute, (c) => c.json(deps.meta.getMeta(), 200));

  return router;
}
