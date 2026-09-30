import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { basicAuth } from 'hono/basic-auth';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import {
  CREDENTIAL_CHECK_PATHS,
  EMAIL_SENDING_PATHS,
  OTP_SEND_WINDOW_MS,
  OTP_SENDS_PER_EMAIL,
  OTP_SIGN_IN_WINDOW_MS,
  OTP_SIGN_INS_PER_EMAIL,
} from './auth.ts';
import { problemResponse, titleFor } from './lib/errors.ts';
import { emailLimit } from './middleware/email-limit.ts';
import { errorHandler, notFoundHandler, validationHook } from './middleware/error-handling.ts';
import { rateLimit } from './middleware/rate-limit.ts';
import { requestLogger } from './middleware/request-logger.ts';
import { requireSession } from './middleware/session.ts';
import { createCatalogRouter } from './routes/catalog.ts';
import { createMeRouter } from './routes/me.ts';
import { createRecommendationsRouter } from './routes/recommendations.ts';
import { createSystemRouter } from './routes/system.ts';
import { createHealthService } from './services/health.ts';
import { createMetaService } from './services/meta.ts';
import { createRecommendationService } from './services/recommendations.ts';
import type { AppDeps, AppEnv } from './types.ts';

export const AUTH_RATE_LIMIT_PER_MIN = 20;
/** Requests per client IP per minute across `/v1/me/*`. */
export const ME_RATE_LIMIT_PER_MIN = 120;
/** Upper bound for JSON request bodies. */
export const MAX_JSON_BODY_BYTES = 16 * 1024;
/** Upper bound for POST /v1/me/changes (500 ops of ~150 bytes, with headroom). */
export const MAX_CHANGES_BODY_BYTES = 256 * 1024;

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
      allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
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
      edgeProxySecret: deps.env.EDGE_PROXY_SECRET,
      ...(method === undefined ? {} : { skip: (c) => c.req.method !== method }),
    });

  const jsonBodyLimit = (maxSize: number) =>
    bodyLimit({
      maxSize,
      onError: (c) =>
        problemResponse({
          type: 'about:blank',
          title: titleFor(413),
          status: 413,
          detail: `Request body exceeds ${maxSize} bytes`,
          instance: c.req.path,
          requestId: c.get('requestId') ?? '',
        }),
    });

  app.use(
    '/v1/recommendations',
    limiter('recommend', deps.env.RATE_LIMIT_RECOMMEND_PER_MIN, 'POST'),
    // Reject oversized bodies before they are buffered and parsed; a valid input is well under 4 KB.
    jsonBodyLimit(MAX_JSON_BODY_BYTES),
  );
  app.use('/api/auth/*', bodyLimit({ maxSize: MAX_JSON_BODY_BYTES }));
  // Only credential-submitting POSTs (sign-in, sign-up, reset); session reads stay unthrottled.
  app.use('/api/auth/*', limiter('auth', AUTH_RATE_LIMIT_PER_MIN, 'POST'));

  // Per-address limits in front of Better Auth: codes minted and guesses made against one address.
  const perEmail = (name: string, limit: number, windowMs: number) =>
    emailLimit({ store: deps.rateLimitStore, name, limit, windowMs });
  for (const path of EMAIL_SENDING_PATHS) {
    app.use(path, perEmail('otp-send', OTP_SENDS_PER_EMAIL, OTP_SEND_WINDOW_MS));
  }
  for (const path of CREDENTIAL_CHECK_PATHS) {
    app.use(path, perEmail('sign-in', OTP_SIGN_INS_PER_EMAIL, OTP_SIGN_IN_WINDOW_MS));
  }

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

  // Signed-in user's data. Limit by IP before the session lookup, so floods never reach the database.
  app.use('/v1/me/*', limiter('me', ME_RATE_LIMIT_PER_MIN), requireSession(deps.auth));
  app.use('/v1/me/changes', jsonBodyLimit(MAX_CHANGES_BODY_BYTES));
  app.route('/', createMeRouter({ userData: deps.userData }));
  app.route(
    '/',
    createRecommendationsRouter({ recommendations: createRecommendationService(deps.catalog) }),
  );

  // API reference: behind HTTP Basic when credentials are configured, hidden in production otherwise.
  const { API_DOCS_USERNAME: docsUser, API_DOCS_PASSWORD: docsPassword } = deps.env;
  const docsProtected = docsUser !== undefined && docsPassword !== undefined;
  if (docsProtected || deps.env.NODE_ENV !== 'production') {
    if (docsProtected) {
      const guard = basicAuth({
        username: docsUser,
        password: docsPassword,
        realm: 'Sipclock API docs',
      });
      app.use('/docs', guard);
      app.use('/openapi.json', guard);
    }
    app.doc31('/openapi.json', {
      openapi: '3.1.0',
      info: {
        title: 'Sipclock API',
        version: '0.0.0',
        description: 'Cocktail recommender backend.',
      },
      ...(deps.env.PUBLIC_BASE_URL ? { servers: [{ url: deps.env.PUBLIC_BASE_URL }] } : {}),
    });
    // Relative, so the page also works behind a path prefix (/sipclock/docs → /sipclock/openapi.json).
    app.get('/docs', Scalar({ url: 'openapi.json' }));
  }

  return app;
}

export type App = ReturnType<typeof createApp>;
