# Sipclock web

Next.js 16 (App Router, Turbopack, React Compiler, typed routes), locales `en` and `ru` under `src/app/[locale]`.
Recipe pages are statically generated; everything that depends on the signed-in user is a client island.

## Commands

```bash
pnpm --filter @sipclock/web dev        # http://localhost:3000
pnpm --filter @sipclock/web typecheck
pnpm --filter @sipclock/web test       # vitest
pnpm --filter @sipclock/web e2e        # Playwright, builds and serves on :3100; needs no API
pnpm --filter @sipclock/web build
```

Use Node 24 (`nvm use 24`).

## Environment

| Variable | Scope | Purpose |
| --- | --- | --- |
| `API_ORIGIN` | server only | Origin of the Sipclock API. Dev default `http://localhost:8787`; prod `https://4db4f06b3824.vps.myjino.ru/sipclock`. |
| `EDGE_PROXY_SECRET` | server only, optional in dev | Sent to the API as `X-Sipclock-Proxy-Secret` so it trusts `X-Sipclock-Client-Ip`. Must equal the API's value. |
| `NEXT_PUBLIC_SITE_URL` | public | Canonical site URL for metadata. |

## Accounts and the API proxy

See [ADR 0006](../../docs/adr/0006-accounts-and-sync.md).

The browser only ever talks to its own origin, so session cookies are first-party (Safari drops third-party
cookies). The route handler `src/app/api/[...path]/route.ts` forwards:

- `/api/auth/*` to `${API_ORIGIN}/api/auth/*` (Better Auth: email code sign-in, sign-out, delete account),
- `/api/me/*` to `${API_ORIGIN}/v1/me/*` (`GET /api/me/data`, `POST /api/me/changes`),
- anything else: 404.

Only `GET` and `POST` are proxied, redirects are not followed and upstream calls time out after 15 s (504; 502 when
the API is unreachable). Request headers are an allowlist (`cookie`, `content-type`, `accept`, `origin`,
`user-agent`, `idempotency-key`, `x-request-id`); client-supplied `x-sipclock-*` headers are dropped, then the proxy
sets `X-Sipclock-Client-Ip` (first `x-forwarded-for` entry, else `x-real-ip`) and `X-Sipclock-Proxy-Secret`. All
`Set-Cookie` headers are passed on separately, with any `Domain=` attribute removed. The pure helpers are in
`src/lib/api-proxy.ts`. `src/proxy.ts` (locale routing) skips `/api/*`.

`src/lib/user-data.ts` is the client store for the bar, favorites and history:

- Guest: `localStorage` (`sipclock.bar`, `sipclock.favorites`). Drink history is not stored for guests.
- Signed in: reads `/api/me/data`; writes are optimistic, one `POST /api/me/changes` per action with a fresh
  `Idempotency-Key` (retried once with the same key on a network error), and rolled back with a notice on failure.
- First sign-in in a browser with guest data: one merge batch, then the guest keys are cleared. The batch is stored
  under `sipclock.merge` until it succeeds, so a reload or retry reuses the same ops and key.

## Local development with accounts

Run the API on `:8787` (see `apps/api`), then `pnpm --filter @sipclock/web dev`. Without the API the site works
as a guest; the header session check fails quietly and Sign in shows an error when you request a code.
