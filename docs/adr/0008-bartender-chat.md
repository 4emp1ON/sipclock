# 0008. Bartender chat: streamed answers over read-only tools

Date: 2026-10-01 · Status: Accepted · Builds on [0007](0007-llm-gateway.md)

## Context
Phase 4b adds a chat on the web ("Bartender") that answers questions about the user's bar, recipes, swaps and
what to make now. Unlike swaps, an answer is free text that takes several model steps (tool calls, then the
reply), so it is streamed, and the gateway's call-and-wait `run` does not fit. A live probe (2026-10-01) showed
that Yandex `aliceai-llm-flash` streams tool calls and multi-step answers with usage through
`@ai-sdk/openai-compatible`; `yandexgpt/rc` does too; full `aliceai-llm` ends the stream without a finish reason
when it calls two tools in parallel.

## Decision
- **`POST /v1/ai/chat`** streams an AI SDK 7 UI message stream (`streamText` → `toUIMessageStreamResponse`),
  at most 5 model steps, 600 output tokens per step, 55 s overall. The client sends the conversation as plain
  text lines (role + text, last 20, 2000 characters each, the question at most 500); tool parts never come back
  from the client, so a user cannot forge tool results. Nothing of the conversation is stored on the server.
- **Each model step is fetched whole and replayed as a stream** (`simulateStreamingMiddleware`): Yandex ends a
  streamed response without a finish reason whenever the model calls two tools at once (Flash does so now and
  then; `parallel_tool_calls: false` is ignored), while the same calls succeed without streaming. Tool captions
  still appear step by step; the reply text of a step arrives in one piece.
- **Read-only tools only** (`src/services/chat.ts`): `get_my_bar`, `what_can_i_make`, `search_recipes`,
  `get_recipe`, `find_substitutes`, `recommend_now`. They read the bundled catalog, the engine and the user's
  synced bar; the user id comes from the session, never from model arguments. `find_substitutes` returns
  catalog candidates without a nested model call. Recipe results carry `{ id, name, abv, status, missing }`,
  which the web renders as cards, at most three per tool call.
- **Quota lease** (`AiGateway.open`): one request is taken from the daily quota and the worst-case cost is
  reserved before the stream starts; `settle` charges the reported usage when the stream ends, is aborted or
  fails (the whole reservation when no usage was reported). No provider fallback once streaming has started.
  One answer per user at a time (in-memory, single API instance); a second request gets 409.
- **Brands are masked in the stream**: a transform holds back the last complete word and the one being typed,
  and replaces any brand from the 38-FZ list with the generic catalog ingredient in the answer's language, so a
  brand never reaches the client even when split across chunks.
- **Model**: `aliceai-llm-flash` (the configured `YANDEX_MODEL`) until evals show a better choice; the chat eval
  suite checks tool choice, language, brands, format and refusals on Flash and `yandexgpt/rc`.

## Consequences
- A chat answer costs roughly 0.3 RUB (about 3k input tokens over three steps) and counts as one request of the
  shared daily quota (15 on the free plan); the monthly budget cap still bounds the total.
- The in-memory "one answer per user" lock and the abort handling assume a single API instance; scaling out
  needs the lock in Postgres.
- Mobile (4c) can reuse the same endpoint; React Native needs `expo/fetch` streaming or a JSON fallback.
