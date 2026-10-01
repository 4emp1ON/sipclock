# 0007. LLM gateway and AI features

Date: 2026-10-01 · Status: Accepted · Refines [0002](0002-russian-market-constraints.md)

## Context
Phase 4 adds AI features: ingredient substitutions, a bartender chat with tool calls into our own data,
natural-language search and personalised "why this one" lines. The API runs in Russia (shared 2 vCPU / 4 GB
VPS, api container limited to 384 MB, alpine image without `node_modules`, see [0005](0005-deployment-topology.md)).
That host cannot reach `api.anthropic.com`; Anthropic does not offer its API in Russia, and its terms allow
public products only with Console API keys (subscription OAuth tokens are for personal use of Claude apps).
GigaChat documents legacy `functions` instead of `tools`, needs the Russian root CA and a 30-minute OAuth token,
and sells to new customers only through cloud.ru. Yandex AI Studio has an OpenAI-compatible endpoint with tools
and JSON-schema output, long-lived service-account keys and card billing for individuals. The catalog is small
(50 recipes, 81 ingredients).

## Decision
- **Vercel AI SDK 7** is the provider abstraction. `src/ai/providers.ts` registers a model per provider with its
  token price: **Yandex AI Studio** through `@ai-sdk/openai-compatible`, **Claude** (Haiku 4.5 by default)
  through `@ai-sdk/anthropic` with a Console API key. Features call `generateText`/`streamText` on whatever model
  the gateway hands them and never name a vendor.
- **Routing by sticky account region** (`src/ai/region.ts`). The client country comes from a local DB-IP Lite
  database baked into the image; the locale from the request. A request from Russia or Belarus, or in Russian,
  pins the account to Yandex for good. Claude serves only accounts never pinned, from a known non-Russian
  country with a non-Russian locale; anything uncertain goes to Yandex. A VPN user is caught as soon as one
  request reveals the region; a wrong guess only costs a provider switch.
- **Claude is reached through a relay** in a supported region (the developer's VPS in Italy): its own nginx
  location and key (`X-Proxy-Key`, stripped before forwarding), an allowlist of the API host's address and
  request rate limits. Without `ANTHROPIC_*` settings every user is served by Yandex.
- **Signed-in users only, with quotas** (`src/ai/gateway.ts`, `src/ai/store.ts`): a daily request quota per plan
  (`free` until monetization), reserved atomically before the call (one `INSERT … ON CONFLICT … WHERE` statement,
  so parallel requests cannot overshoot) and given back if every provider fails. A monthly spend cap per provider
  reserves the worst-case cost of a call (estimated input + `maxOutputTokens`) before it and settles the actual
  cost after; past the cap Claude falls back to Yandex and Yandex answers from the catalog. `/v1/ai/*` also has
  a per-IP limit and a body limit (16 KB; 48 KB for the chat, see [0008](0008-bartender-chat.md)).
- **Grounded output.** Models choose among catalog ids (structured output with an enum, re-checked on the
  server) and write short notes. Notes pass output checks (`src/ai/guard.ts`): single line, no links, length
  cap, language matches the locale, no alcohol brands (38-FZ); a failing note is replaced by the editors' note or
  dropped. Every AI route has a deterministic fallback from the catalog, so quota, outages and budget caps
  degrade the answer instead of failing it.
- **Data.** Prompts and answers about a user are not stored; logs keep feature, model, tokens, cost and latency.
  The answer cache holds only results derived from catalog ids and the locale, so it is shared across users and
  cannot carry one user's text to another.
- **No job queue or self-hosted models for now.** pg-boss and an in-process embedding model do not fit the
  container budget, and a 50-recipe catalog needs neither. Search embeddings will come from Yandex and live in
  pgvector without an ANN index until the catalog grows.
- **Evals.** Unit tests run the gateway and features against AI SDK mock models on every CI run. Quality evals
  (tool choice, grounding, language, refusals, brands) run against both providers with promptfoo on demand, not
  on every push, because they cost money.

## Consequences
- Two providers answer differently; the eval suite has to pass on both before a prompt change ships.
- Claude availability depends on the relay host; failures fall back to Yandex, so the cost is quality, not
  downtime.
- Region pinning is one-way by design; an international user who once used Russian locale stays on Yandex.
- Prices live in code (`providers.ts`) and must be updated when providers change them; unknown models are
  priced at the most expensive known rate, so budgets err on the safe side.
- Serving Claude from a Russia-based deployment through a relay was accepted as a business risk by the owner;
  turning `ANTHROPIC_*` off moves everyone to Yandex without a deploy of code.
