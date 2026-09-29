# Sipclock

The right cocktail for this hour. Sipclock picks what to make right now from the date and time, the occasion, the
weather and what is already in your home bar, and explains why. iOS, Android and web.

## Repository

| Path | What |
|---|---|
| `apps/mobile` | Expo SDK 57 app (React Native 0.86, Expo Router, Uniwind) |
| `apps/web` | Next.js 16 web app and SEO recipe pages |
| `apps/api` | Hono API on Node 24: OpenAPI, Postgres + Drizzle, Better Auth |
| `packages/tokens` | Design tokens generated from the design system (CSS variables, Tailwind theme, TS) |
| `docs/adr` | Architecture decision records |
| `references` | Original concept screenshots |

Design sources: [design system](https://claude.ai/artifact/UjQRFeYa5EGKKtv2gy4psF),
[screens](https://claude.ai/artifact/4mxptfo9rzKLwuhCjGsYN5),
[product concept](https://claude.ai/artifact/Nr19dpBJ994f1ezKkKuEqZ).

## Getting started

Requirements: Node 24 (`nvm use`), pnpm 12, Docker (for Postgres).

```sh
pnpm install
pnpm db:up                                   # Postgres 17 + pgvector
cp apps/api/.env.example apps/api/.env
pnpm --filter @sipclock/api db:migrate
pnpm dev                                     # api :8787, web :3000, Expo dev server
```

## Checks

```sh
pnpm lint        # Biome
pnpm typecheck
pnpm test        # Vitest (packages, api, web) and Jest (mobile)
pnpm tokens      # regenerate design tokens after updating packages/tokens/src/tokens.json
```

CI (`.github/workflows/ci.yml`) runs lint, token freshness, typecheck and unit tests, API integration tests against
Postgres, web build + Playwright, and iOS/Android JS bundles.

## Roadmap

1. Skeleton: monorepo, CI, tokens, API, web, mobile ← *current*
2. Public demo of "what to make right now": recommendation engine, catalog, recipe scaling, local bar, SEO pages
3. Accounts and offline sync
4. AI bartender (LLM gateway, tool calling, evals), semantic search
5. Subscriptions (RevenueCat, entitlements, RuStore)
6. Operations: OpenTelemetry, load and accessibility budgets, widgets, Terraform
