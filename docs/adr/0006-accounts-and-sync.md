# 0006. Accounts and user data sync

Date: 2026-09-30 · Status: Accepted · Refines [0003](0003-offline-and-sync.md)

## Context
Phase 3 adds accounts and makes the bar, favorites and drink history follow the user across devices. The app
must stay fully usable without an account and offline. The API runs on a shared 4 GB VPS behind a path prefix
(`/sipclock`, see [0005](0005-deployment-topology.md)); the web runs on `sipclock.vercel.app`, another site.

## Decision
- **Sign-in:** Better Auth with a 6-digit email code (email OTP plugin, sent through Resend) as the default, and
  email + password as an option. A password account works only after the address is confirmed with a code (so
  nobody can claim someone else's address); resets use a code too and revoke all sessions; breached passwords
  are rejected. Passkeys come with an own domain: their relying-party ID is bound to the domain, so passkeys
  created on `sipclock.vercel.app` would stop working after a move.
  Codes sent and sign-in attempts are limited per address in front of Better Auth, whose own limiter is off
  (it trusts spoofable headers). Apple and Google sign-in come later, when developer accounts exist.
  Account deletion is available in the apps (App Store requirement); user data rows cascade. A session older
  than a day re-confirms with an email code before deleting.
- **Guests are local-only.** No anonymous server users: the first launch must work offline. On mobile, guest
  writes stay in PowerSync's upload queue and are uploaded to the account on first sign-in, which merges guest
  data into it. An explicit sign-out or account deletion clears local user data; a session that just ends
  (expiry, revocation) only disconnects, so changes queued meanwhile upload when the same account signs in
  again (another account signing in clears them first).
- **Mobile sync:** PowerSync (self-hosted service, Sync Streams, Postgres bucket storage in a separate database on
  the same Postgres server). The local database is PowerSync's SQLite (op-sqlite); expo-sqlite is removed.
  The service authenticates clients with short-lived JWTs from Better Auth's JWT plugin (EdDSA, JWKS, audience
  `sipclock-powersync`).
- **Web is online.** No PowerSync on the web: it would need Webpack instead of Turbopack and client-only
  rendering. Signed-in web reads `GET /v1/me/data` and writes through the same endpoint as mobile; guests keep
  using `localStorage`, merged into the account on sign-in.
- **One write path:** `POST /v1/me/changes` with an `Idempotency-Key` header. The contract lives in
  `@sipclock/domain` (`user-data.ts`). Conflicts: last writer wins per row by client clock; each mutable table has a
  single mutable field, so this is LWW per field. Clocks ahead of the server by more than 5 minutes are clamped.
  Removals are tombstones (`in_bar = false`), synced like any other value, so a stale device cannot resurrect them.
- **Same-site cookies on the web:** a Next.js route handler proxies `/api/auth/*` and `/api/me/*` to the API, so
  session cookies are first-party on the web origin (Safari drops third-party cookies). It forwards the client IP
  in a header authenticated by a shared secret, so rate limits stay per user rather than per Vercel egress IP.
  Mobile calls the API directly and sends the session cookie from secure storage.

## Consequences
- Postgres runs with `wal_level=logical`; a `powersync` publication lists only the user data tables.
- Client clocks decide conflicts. Acceptable for a bar and favorites; revisit (hybrid logical clocks) if
  collaborative data such as shared lists appears.
- The PowerSync service needs its own route through the shared edge router and ~512 MB–1 GB of RAM.
- Zero (Rocicorp) 1.x remains the fallback; the client sync layer is kept behind small repository functions.
