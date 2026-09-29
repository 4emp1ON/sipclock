# 0003. Catalog bundle + sync engine for user data only

Date: 2026-09-29 · Status: Accepted

## Context
The core loop ("what to make right now") must work offline. Data splits into a large, rarely changing catalog
(recipes, ingredients, substitutions) and small, frequently changing user data (bar, favorites, lists, history).

## Decision
- The **catalog** ships as a versioned bundle with deltas, fetched and cached by the apps; it is not synced row by row.
- **User data** syncs through PowerSync (SQLite on device ↔ Postgres, self-hosted, Sync Streams). Writes go through
  the Hono API with idempotency keys; conflicts resolve last-writer-wins per field, covered by tests.
- The **recommendation engine** is a pure, deterministic function
  `recommend(inputs, catalogVersion, rulesVersion, seed)` in a shared package. The same golden tests run on the device,
  the server and the web.

## Consequences
- The engine must not depend on I/O; weather and time are inputs.
- PowerSync's Drizzle integration is alpha; the sync layer stays thin so it can be swapped (Zero 1.0 is the fallback).
