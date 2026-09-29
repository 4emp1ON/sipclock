# 0004. Design tokens generated from the design system

Date: 2026-09-29 · Status: Accepted

## Context
The design system lives in Claude Design as `tokens.json` (colors per theme, type scale, spacing, radii, shadows).
Web (Tailwind v4) and mobile (Uniwind) both need it, and values must not drift.

## Decision
`packages/tokens` keeps a copy of `tokens.json` and generates CSS variables, a Tailwind v4 `@theme`, and a typed TS
object. Generated files are committed; CI runs `check` to fail on stale output. Unit tests assert that every color
exists in every theme and that documented text/background pairs meet WCAG contrast (4.5:1 text, 3:1 controls).

## Consequences
- Design changes arrive as a `tokens.json` update plus `pnpm tokens`.
- Components are implemented per platform; only tokens are shared.
