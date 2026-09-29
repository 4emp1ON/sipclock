# 0001. TypeScript monorepo: Expo, Next.js, Hono

Date: 2026-09-29 · Status: Accepted

## Context
Sipclock ships to iOS, Android and the web and is built by one developer as a portfolio project for fullstack roles
(Russian and international markets). The stack must be current, widely used in hiring, and feasible for one person.
Alternatives considered: Kotlin/Compose Multiplatform (web target still Beta), Flutter (canvas web, weaker SEO, Dart
does not carry over to the backend), native Swift + Kotlin (two codebases, no web).

## Decision
- **One language end to end:** TypeScript 6 (strict). TypeScript 7 (native compiler) is released but Next.js and Expo
  tooling still load the JS compiler API; revisit when both support it.
- **Monorepo:** pnpm 12 workspaces + Turborepo; internal packages are consumed as TypeScript source (no build step)
  except generated artifacts.
- **Mobile:** Expo SDK 57 (React Native 0.86, New Architecture, Hermes V1), Expo Router, Uniwind (Tailwind v4 for RN).
  Native Swift/Kotlin only where it earns its place (widgets, on-device models) via Expo Modules.
- **Web:** Next.js 16 (App Router, Server Components, Turbopack, React Compiler) as the web product and SEO surface.
  Expo web is not shipped; UI components are not shared across RN and web — tokens, domain, engine, i18n and the API
  client are.
- **Backend:** Hono on Node 24 (type stripping, no build step) with Zod → OpenAPI, PostgreSQL 17 + Drizzle, pgvector,
  Better Auth, pg-boss for background jobs.
- **Tooling:** Biome (lint + format), Vitest (unit), Playwright (web e2e), Jest via jest-expo (mobile unit), Maestro
  (mobile e2e, later), GitHub Actions, EAS Build/Update.

## Consequences
- Shared packages must stay platform-neutral (no DOM, no RN imports).
- Node 24 type stripping forbids non-erasable TS syntax in the API (no enums, namespaces, parameter properties).
- Expo SDK 58 is in beta; plan an upgrade once it is stable (stable Expo Router SSR, RN 0.88).
