import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { errorHandler, notFoundHandler, validationHook } from './middleware/error-handling.ts';
import { requestLogger } from './middleware/request-logger.ts';
import { createSystemRouter } from './routes/system.ts';
import { createHealthService } from './services/health.ts';
import { createMetaService } from './services/meta.ts';
import type { AppDeps, AppEnv } from './types.ts';

export function createApp(deps: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });

  app.use(requestId({ headerName: 'X-Request-Id' }));
  app.use(requestLogger(deps.logger));
  app.use(secureHeaders());
  app.use(
    cors({
      origin: deps.env.CORS_ORIGINS,
      credentials: true,
      exposeHeaders: ['X-Request-Id'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    }),
  );

  app.onError(errorHandler(deps.logger));
  app.notFound(notFoundHandler());

  // Better Auth owns everything under /api/auth/*.
  app.on(['GET', 'POST'], '/api/auth/*', (c) => deps.auth.handler(c.req.raw));

  app.route(
    '/',
    createSystemRouter({
      health: createHealthService(deps.ping),
      meta: createMetaService(),
    }),
  );

  app.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'Sipclock API',
      version: '0.0.0',
      description: 'Cocktail recommender backend.',
    },
  });
  app.get('/docs', Scalar({ url: '/openapi.json' }));

  return app;
}

export type App = ReturnType<typeof createApp>;
