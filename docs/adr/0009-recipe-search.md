# 0009. Recipe search: lexical everywhere, hybrid with pgvector on the API

Date: 2026-10-02 · Status: Accepted · Builds on [0007](0007-llm-gateway.md)

## Context
Neither app could search recipes: the web filtered by occasion, the mobile Search tab was a placeholder, and the
chat matched substrings. Users ask by name, by ingredient and by mood ("что-нибудь согревающее", "tropical and
sweet"), in English and Russian, sometimes offline. The catalog has 202 recipes. Yandex AI Studio offers
`text-search-doc` / `text-search-query` embeddings (256 dimensions, one input per request, a per-second rate limit)
at a fraction of generation cost; the production Postgres image already ships pgvector.

## Decision
- **One lexical searcher** in `@sipclock/engine` (`createRecipeSearcher`), used by the API, the chat tool and both
  clients offline: names, ingredients (with their generic parents), tags and descriptions in both languages,
  weighted by field; Russian endings match by stem ("мятой" → "мята"), English words only by extension
  ("lemons" → "lemon"), and only the word being typed matches as a prefix ("negr" → "negroni", but "gin" never
  finds "ginger").
- **Semantic half on the API**: each recipe is embedded once per language from a short single-language document
  (name, description, ingredients, flavours, occasions, strength in words) into `recipe_embedding` (pgvector,
  `vector(256)`, key recipe + locale, no ANN index: 404 rows are scanned exactly). The API embeds what changed at
  start-up, by text hash, one request at a time; a failed document is retried on the next start.
- **`GET /v1/search`** fuses the two lists by reciprocal rank fusion (k = 60). A lexical hit counts by the share of
  query words it covers, so a single shared word cannot outrank meaning; semantic neighbours within 0.06 cosine
  distance of the best one are kept and marked `meaning`, never farther than 0.75 (off-topic queries land near
  0.8), and only nearer than 0.58 when no query word occurs in the catalog (gibberish lands at 0.61–0.67, among
  real mood queries, so it needs a lexical anchor). Query embeddings are cached in memory (LRU, 1000).
- **Public, without the AI quota** (owner's decision 2026-10-02): search is basic functionality and an embedded
  query costs about 0.0002 RUB. It is limited to 60 requests per IP per minute (any method: HEAD runs the GET handler) and to 300 query
  embeddings per minute for the whole process, every embedding call is charged
  against the monthly Yandex budget, and past the budget, on a 2 s timeout or any provider error the answer is
  lexical only (`semantic: false`). Query vectors are kept only in process memory.
- **Clients** show local lexical results at once and replace them with the API order when it answers; offline,
  rate-limited or failed requests keep the local answer silently. Filters (can make now, alcohol-free, strength,
  glass, occasion) are applied on the client over either list.
- **Quality is measured**: `apps/api/evals/search` scores hit@5 and recall@5 over 26 English and Russian queries
  whose expected answers are rules over the catalog. At acceptance: lexical 0.96 / 0.72, semantic only
  0.92 / 0.55, hybrid 1.00 / 0.76. The run fails below hybrid hit@5 0.85.

## Consequences
- A new recipe or a changed description is searchable lexically at once and semantically after the next API start.
- Changing the embedding model re-embeds the catalog (the model name is stored with each vector).
- 202 recipes need no ANN index or job queue; an HNSW index becomes worthwhile in the thousands of rows.
- Weak spots the eval keeps visible: mood plus flavour queries in Russian ("тропический сладкий") and
  "alcohol-free and sour"; better documents or a reranker are the next levers.
