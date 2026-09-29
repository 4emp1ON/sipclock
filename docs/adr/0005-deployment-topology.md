# 0005. Deployment topology: Vercel for web, shared VPS for API

Date: 2026-09-29 · Status: Accepted

## Context
The public demo needs the web app online with CDN and SEO, and the API with Postgres. A VPS at Jino
already runs another project (SweetVilka) whose web container published port 80; Jino's front nginx
terminates TLS and forwards the VPS domains to port 80 only. There is no custom domain yet.

## Decision
- **Web on Vercel** (project `sipclock`, root directory `apps/web`, Turborepo build, pnpm 12 via corepack).
  The engine runs in the browser, so the web demo does not depend on the API.
- **API on the VPS** as an esbuild bundle in a ~250 MB image without `node_modules` (better-auth's optional
  peers would otherwise pull the monorepo's Next.js and Expo into the image). Images are built by GitHub
  Actions and pushed to GHCR; the server only pulls.
- **Shared edge router**: a Caddy compose project owns port 80 and routes by host and path; SweetVilka's
  web moves to `127.0.0.1:3080`. Caddy forwards `X-Forwarded-*` unchanged because both apps take the
  client IP from the last `X-Forwarded-For` entry, which Jino appends.
- **Least-privilege deploys**: the CI key can only run `deploy.sh` with an image tag (forced command).
- Until a domain exists, the API lives under `/sipclock` on the VPS technical hostname.

## Consequences
- A second project on the VPS no longer requires touching SweetVilka again: add a route to the Caddyfile.
- The VPS is in Russia, which fits 152-FZ for Russian users; the international region is a later concern.
- Jino blocks some foreign hosts (e.g. api.anthropic.com); the LLM gateway (ADR 0002) must account for it.
