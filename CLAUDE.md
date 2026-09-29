# Sipclock — working notes for agents

- Node 24 via nvm: prefix shell commands with `source ~/.nvm/nvm.sh >/dev/null && nvm use 24 >/dev/null &&`.
  The system Node is 20 and too old.
- pnpm 12 workspaces + Turborepo. Add mobile dependencies with `npx expo install` inside `apps/mobile` so versions match
  the Expo SDK; elsewhere use `pnpm --filter <pkg> add`.
- `apps/api` runs TypeScript directly on Node 24 (type stripping): only erasable syntax, relative imports with `.ts`.
- Design tokens: edit `packages/tokens/src/tokens.json`, then `pnpm tokens`. Never hardcode colors in apps.
- UI copy is English, concise, verbs on buttons, no emoji. Night theme is primary.
- Decisions live in `docs/adr`; add a record when you change stack or architecture.
- Before finishing: `pnpm lint && pnpm typecheck && pnpm test`.
