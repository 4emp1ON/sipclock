import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { problemResponse, titleFor } from './lib/errors.ts';
import { errorHandler, notFoundHandler, validationHook } from './middleware/error-handling.ts';
import { rateLimit } from './middleware/rate-limit.ts';
import { requestLogger } from './middleware/request-logger.ts';
import { createCatalogRouter } from './routes/catalog.ts';
import { createRecommendationsRouter } from './routes/recommendations.ts';
import { createSystemRouter } from './routes/system.ts';
import { createHealthService } from './services/health.ts';
import { createMetaService } from './services/meta.ts';
import { createRecommendationService } from './services/recommendations.ts';
import type { AppDeps, AppEnv } from './types.ts';

export const AUTH_RATE_LIMIT_PER_MIN = 20;
/** Upper bound for JSON request bodies. */
export const MAX_JSON_BODY_BYTES = 16 * 1024;

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

  const limiter = (name: string, limit: number, method?: string) =>
    rateLimit({
      store: deps.rateLimitStore,
      name,
      limit,
      trustedProxyHops: deps.env.TRUST_PROXY_HOPS,
      ...(method === undefined ? {} : { skip: (c) => c.req.method !== method }),
    });

  app.use(
    '/v1/recommendations',
    limiter('recommend', deps.env.RATE_LIMIT_RECOMMEND_PER_MIN, 'POST'),
    // Reject oversized bodies before they are buffered and parsed; a valid input is well under 4 KB.
    bodyLimit({
      maxSize: MAX_JSON_BODY_BYTES,
      onError: (c) =>
        problemResponse({
          type: 'about:blank',
          title: titleFor(413),
          status: 413,
          detail: `Request body exceeds ${MAX_JSON_BODY_BYTES} bytes`,
          instance: c.req.path,
          requestId: c.get('requestId') ?? '',
        }),
    }),
  );
  app.use('/api/auth/*', bodyLimit({ maxSize: MAX_JSON_BODY_BYTES }));
  // Only credential-submitting POSTs (sign-in, sign-up, reset); session reads stay unthrottled.
  app.use('/api/auth/*', limiter('auth', AUTH_RATE_LIMIT_PER_MIN, 'POST'));

  // Better Auth owns everything under /api/auth/*.
  app.on(['GET', 'POST'], '/api/auth/*', (c) => deps.auth.handler(c.req.raw));

  app.route(
    '/',
    createSystemRouter({
      health: createHealthService(deps.ping),
      meta: createMetaService(deps.catalog.manifest.version),
    }),
  );

  app.route('/', createCatalogRouter({ catalog: deps.catalog }));
  app.route(
    '/',
    createRecommendationsRouter({ recommendations: createRecommendationService(deps.catalog) }),
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
