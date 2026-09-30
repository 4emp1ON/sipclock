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
(the DB integration tests run only when `DATABASE_URL` is set, e.g.
`DATABASE_URL=postgres://sipclock:sipclock@localhost:5432/sipclock pnpm --filter @sipclock/api test`;
they create and delete their own users and clear the `jwks` table before and after).

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
| `POST /v1/me/changes` | Signed in. Applies a `ChangeBatch` (`@sipclock/domain`, up to 500 ops) in one transaction; returns `{ applied, skipped }`. Requires `Idempotency-Key` (1-128 chars): a repeated key returns the stored result without re-applying (keys kept 24 h). Body limit 256 KB |
| `GET /v1/me/data` | Signed in. `UserDataSnapshot`: `bar`, `favorites` (oldest change first, removed items excluded), `history` (newest first, max 200) |
| `/api/auth/*` | Better Auth, see below |

Rate limits (fixed window, per client IP, in-memory store behind the `RateLimitStore` interface):
`POST /v1/recommendations` `RATE_LIMIT_RECOMMEND_PER_MIN` (default 60), `POST /api/auth/*` 20 per minute,
`/v1/me/*` 120 per minute (checked before the session lookup). Better Auth's own limiter is disabled: it
keys by the spoofable `X-Forwarded-For`. Responses carry `RateLimit-Limit/Remaining/Reset`; 429 adds
`Retry-After`. Client IP, in order:
1. `X-Sipclock-Client-Ip`, only when `EDGE_PROXY_SECRET` is set and the request carries it in
   `X-Sipclock-Proxy-Secret` (constant-time compare). The web app's server-side proxy sends both, so
   limits stay per user rather than per Vercel egress IP. Without a matching secret the header is ignored.
2. Behind reverse proxies, the `X-Forwarded-For` entry `TRUST_PROXY_HOPS` from the right (entries further
   left are client-controlled and ignored).
3. The socket address.

## Accounts and sync

See [ADR 0006](../../docs/adr/0006-accounts-and-sync.md). Better Auth plugins:

- **Email code** (`emailOTP`): `POST /api/auth/email-otp/send-verification-otp` `{ email, type: "sign-in" }`,
  then `POST /api/auth/sign-in/email-otp` `{ email, otp }` (signs up on first use). 6 digits, valid 5 minutes,
  3 attempts. Sent through Resend when `RESEND_API_KEY` is set (delivery is not awaited; failures are
  logged). Without a key the code is logged at info level as `email otp (dev)` outside production; in
  production nothing is sent and an error is logged. Email + password stays enabled.
- **JWT** (`jwt`): `GET /api/auth/token` returns a 15-minute EdDSA token for PowerSync
  (`aud` = `POWERSYNC_AUDIENCE`, `iss` = `BETTER_AUTH_URL`, `sub` = user id, no personal data). Keys at
  `GET /api/auth/jwks`, stored in the `jwks` table, private keys encrypted with `BETTER_AUTH_SECRET`
  (changing the secret requires deleting the rows).
- **Expo** (`@better-auth/expo`): accepts the `expo-origin` header from the app. Trusted origins are
  `CORS_ORIGINS`, `sipclock://` and, outside production, `exp://`.
- **Account deletion**: `POST /api/auth/delete-user` with a session younger than a day (or `password`);
  user data rows cascade.

`/v1/me/*` reads the Better Auth session (cookie) and answers 401 problem+json without one. Writes use
last-writer-wins per row on the client clock `updated_at` (ties keep the stored row), clamp clocks more than
5 minutes ahead to server time, store deletes of bar items and favorites as tombstones at server time, keep
drink log entries immutable (an existing id, even another user's, is skipped), and skip unknown catalog ids.

Tables `bar_item`, `favorite`, `drink_log` are published to PowerSync (`CREATE PUBLICATION powersync`,
`SELECT` granted to `powersync_role` when that role exists); `idempotency_key` is not replicated.

Errors are RFC 9457 `application/problem+json` with `requestId`; validation errors add `errors[]`.

## Architecture

- `src/env.ts` - zod-validated environment.
- `src/server.ts` - composition root: env, DB, auth, app, graceful shutdown.
- `src/app.ts` - `createApp(deps)`; all dependencies injected (testable with `app.request()`).
- `src/routes/` - OpenAPIHono routers (HTTP only). `src/services/` - business logic.
- `src/middleware/` - request id, logging, error handling, rate limit, session. `src/lib/` - errors, logger, Sentry.
- `src/db/` - postgres.js + drizzle client and schema. `src/auth.ts` - Better Auth factory.

## Environment

See `.env.example` (NODE_ENV, PORT, DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL,
CORS_ORIGINS, SENTRY_DSN, TRUST_PROXY_HOPS, RATE_LIMIT_RECOMMEND_PER_MIN, LOG_LEVEL, PUBLIC_BASE_URL,
API_DOCS_USERNAME, API_DOCS_PASSWORD, RESEND_API_KEY, EMAIL_FROM, POWERSYNC_AUDIENCE, EDGE_PROXY_SECRET).
