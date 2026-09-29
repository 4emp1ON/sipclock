# @sipclock/api

Backend for Sipclock: Hono + OpenAPI (zod), Better Auth, Drizzle ORM on Postgres (pgvector).
Runs on Node 24 directly from TypeScript (type stripping), so only erasable TS syntax and
`.ts` import extensions are used.

## Run

```sh
cp apps/api/.env.example apps/api/.env          # adjust secrets
docker compose up -d postgres                   # from repo root (pgvector/pg17)
pnpm --filter @sipclock/api db:migrate          # apply drizzle/ migrations
pnpm --filter @sipclock/api dev                 # http://localhost:8787
```

`docker compose --profile full up --build` also builds and runs the API container.
After schema changes: `pnpm --filter @sipclock/api db:generate`.

Checks: `pnpm --filter @sipclock/api typecheck`, `pnpm --filter @sipclock/api test`
(the DB integration test runs only when `DATABASE_URL` is set).

## Endpoints

| Route | Description |
|---|---|
| `GET /health` | Liveness, no DB |
| `GET /ready` | 200 if DB ping succeeds, else 503 problem+json |
| `GET /v1/meta` | `{ apiVersion, catalogVersion, time }` |
| `GET /v1/catalog/manifest` | `{ version, sha256, recipes, ingredients, alcoholFree }` |
| `GET /v1/catalog` | Full catalog bundle. Strong `ETag` (= manifest sha256), `If-None-Match` -> 304, `Cache-Control: public, max-age=300, stale-while-revalidate=86400`, gzip/deflate via `Accept-Encoding` |
| `POST /v1/recommendations` | Engine pick + alternatives for a moment (`RecommendInput`); unknown `bar`/`recent` ids -> 400; embeds minimal `recipes[]` (`id, name, glass, method`); `Cache-Control: no-store`; rate limited |
| `GET /openapi.json` | OpenAPI 3.1 document |
| `GET /docs` | Scalar API reference |
| `/api/auth/*` | Better Auth (email + password) |

Rate limits (fixed window, per client IP, in-memory store behind the `RateLimitStore` interface):
`POST /v1/recommendations` `RATE_LIMIT_RECOMMEND_PER_MIN` (default 60), `POST /api/auth/*` 20 per minute.
Responses carry `RateLimit-Limit/Remaining/Reset`; 429 adds `Retry-After`. Client IP is the socket address,
or the first `X-Forwarded-For` hop when `TRUST_PROXY=true` (set it only behind a proxy that overwrites the header).

Errors are RFC 9457 `application/problem+json` with `requestId`; validation errors add `errors[]`.

## Architecture

- `src/env.ts` - zod-validated environment.
- `src/server.ts` - composition root: env, DB, auth, app, graceful shutdown.
- `src/app.ts` - `createApp(deps)`; all dependencies injected (testable with `app.request()`).
- `src/routes/` - OpenAPIHono routers (HTTP only). `src/services/` - business logic.
- `src/middleware/` - request id, logging, error handling. `src/lib/` - errors, logger, Sentry.
- `src/db/` - postgres.js + drizzle client and schema. `src/auth.ts` - Better Auth factory.

## Environment

See `.env.example` (NODE_ENV, PORT, DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL,
CORS_ORIGINS, SENTRY_DSN, TRUST_PROXY, RATE_LIMIT_RECOMMEND_PER_MIN, LOG_LEVEL).
