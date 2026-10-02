import { createHash } from 'node:crypto';
import type { Recipe } from '@sipclock/domain';
import {
  createIndex,
  createRecipeSearcher,
  estimateAbv,
  queryWords,
  type SearchField,
} from '@sipclock/engine';
import { flavorLabel, type Locale, occasionLabel } from '@sipclock/i18n';
import { eq, sql } from 'drizzle-orm';
import type { Embedder } from '../ai/providers.ts';
import type { AiStore } from '../ai/store.ts';
import type { Database } from '../db/client.ts';
import { recipeEmbedding } from '../db/schema/search.ts';
import type { Logger } from '../lib/logger.ts';
import type { CatalogService } from './catalog.ts';

// Hybrid recipe search (docs/adr/0009): the engine's lexical searcher fused with pgvector similarity by
// reciprocal rank. Semantic search is best effort: without a provider, past the budget or on a slow call
// the answer is lexical only.

export type ResultField = SearchField | 'meaning';

export interface SearchResult {
  id: string;
  score: number;
  /** Where the query matched; `meaning` = found by semantic similarity only. */
  field: ResultField;
}

export interface SearchAnswer {
  semantic: boolean;
  results: SearchResult[];
}

export interface SearchService {
  search(query: string, limit: number): Promise<SearchAnswer>;
  /** Embeds recipes whose text changed since the last run; safe to call on every start. */
  indexCatalog(): Promise<{ embedded: number; failed: number; kept: number }>;
}

/** One document per recipe and language: keys are `${recipeId}:${locale}`. */
export interface EmbeddingStore {
  hashes(model: string): Promise<Map<string, string>>;
  upsert(row: {
    recipeId: string;
    locale: Locale;
    model: string;
    textHash: string;
    vector: number[];
  }): Promise<void>;
  /** Nearest recipes by cosine distance (0 = same direction), each recipe once (its closer language). */
  nearest(
    model: string,
    vector: number[],
    limit: number,
  ): Promise<{ recipeId: string; distance: number }[]>;
}

/** Reciprocal rank fusion constant: dampens the gap between first and tenth place. */
const RRF_K = 60;
const LOCALES: readonly Locale[] = ['en', 'ru'];
const CANDIDATES = 30;
/** A semantic neighbour this far behind the best one is noise, not an answer. */
const SEMANTIC_MARGIN = 0.06;
/** Farther than this nothing is related: off-topic queries ("tax return") land around 0.8. */
const MAX_DISTANCE = 0.75;
/**
 * With no word of the query in the catalog, only a close neighbour counts: gibberish ("zzzzqx") lands at
 * 0.61–0.67, where real mood queries also sit, so it needs a lexical anchor or a nearer match.
 */
const MAX_DISTANCE_WITHOUT_WORDS = 0.58;
/** Embedding calls per minute for the whole process: bounds spend whatever the client addresses. */
const QUERY_EMBEDDINGS_PER_MINUTE = 300;
const QUERY_TIMEOUT_MS = 2_000;
const DOC_TIMEOUT_MS = 30_000;
/** Yandex limits embedding requests per second: one at a time keeps the indexer under it. */
const INDEX_CONCURRENCY = 1;
const QUERY_CACHE_SIZE = 1_000;
/** Reserved per query embedding before the call; settled to the reported tokens. */
const QUERY_TOKEN_ESTIMATE = 32;

const STRENGTH: Record<Locale, (abv: number) => string> = {
  en: (abv) => (abv === 0 ? 'alcohol-free' : abv < 15 ? 'light' : 'strong'),
  ru: (abv) => (abv === 0 ? 'безалкогольный' : abv < 15 ? 'лёгкий' : 'крепкий'),
};

/**
 * The text a recipe is embedded from, in one language: name, story, ingredients and its character in words.
 * Short and single-language, because a query lands closest to text written the way it is asked.
 */
export function recipeDocument(
  recipe: Recipe,
  index: ReturnType<typeof createIndex>,
  locale: Locale,
): string {
  const ingredients = recipe.ingredients
    .filter((i) => !i.garnish && index.ingredients.get(i.ingredient)?.staple !== true)
    .map((i) => index.ingredients.get(i.ingredient)?.name[locale])
    .filter((n) => n !== undefined);
  const character = [
    ...recipe.tags.flavors.map((f) => flavorLabel[locale][f]),
    ...recipe.tags.occasions.map((o) => occasionLabel[locale][o]),
    STRENGTH[locale](estimateAbv(recipe, index)),
  ].map((w) => w.toLowerCase());
  return [
    `${recipe.name[locale]}. ${recipe.description[locale]}`,
    `${locale === 'ru' ? 'Состав' : 'Made with'}: ${ingredients.join(', ')}.`,
    `${character.join(', ')}.`,
  ].join('\n');
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const utcMonth = (d: Date) => `${d.toISOString().slice(0, 7)}-01`;
const normalize = (q: string) => q.toLowerCase().replace(/ё/gu, 'е').replace(/\s+/gu, ' ').trim();

export function createSearchService(deps: {
  catalog: CatalogService;
  store: EmbeddingStore;
  embedder: Embedder | undefined;
  spend: Pick<AiStore, 'reserveSpend' | 'settleSpend'>;
  /** Monthly cap for the embedder's provider, in its micro-currency. */
  budget: number;
  logger: Logger;
  now?: () => Date;
}): SearchService {
  const index = createIndex(deps.catalog.catalog);
  const lexical = createRecipeSearcher(index);
  const now = deps.now ?? (() => new Date());
  const queryCache = new Map<string, number[]>();
  const window = { minute: 0, calls: 0 };

  /** One embedding call within the monthly budget; `undefined` when the budget is spent. */
  async function charged<T extends { tokens: number }>(
    embedder: Embedder,
    estimateTokens: number,
    call: () => Promise<T>,
  ): Promise<T | undefined> {
    const month = utcMonth(now());
    const reserved = Math.ceil(estimateTokens * embedder.pricePerToken);
    if (!(await deps.spend.reserveSpend(embedder.provider, month, reserved, deps.budget)))
      return undefined;
    let tokens = estimateTokens;
    try {
      const result = await call();
      tokens = result.tokens;
      return result;
    } finally {
      await deps.spend.settleSpend(
        embedder.provider,
        month,
        reserved,
        Math.ceil(tokens * embedder.pricePerToken),
      );
    }
  }

  async function queryVector(embedder: Embedder, query: string): Promise<number[] | undefined> {
    const key = normalize(query);
    const cached = queryCache.get(key);
    if (cached) {
      // Refresh the entry's place: the map is the LRU order.
      queryCache.delete(key);
      queryCache.set(key, cached);
      return cached;
    }
    // A fixed window per minute: past it, queries are answered lexically until the next minute.
    const minute = Math.floor(now().getTime() / 60_000);
    if (minute !== window.minute) {
      window.minute = minute;
      window.calls = 0;
    }
    if (window.calls >= QUERY_EMBEDDINGS_PER_MINUTE) return undefined;
    window.calls++;
    const result = await charged(embedder, QUERY_TOKEN_ESTIMATE, () =>
      embedder.embed('query', key, AbortSignal.timeout(QUERY_TIMEOUT_MS)),
    );
    if (!result) return undefined;
    queryCache.set(key, result.vector);
    if (queryCache.size > QUERY_CACHE_SIZE) {
      const oldest = queryCache.keys().next().value;
      if (oldest !== undefined) queryCache.delete(oldest);
    }
    return result.vector;
  }

  return {
    async search(query, limit) {
      const lexicalHits = lexical.search(query, { limit: CANDIDATES });
      const fused = new Map<string, SearchResult>();
      const add = (id: string, rank: number, field: ResultField, weight = 1) => {
        const prev = fused.get(id);
        const score = (prev?.score ?? 0) + weight / (RRF_K + rank);
        fused.set(id, { id, score, field: prev?.field ?? field });
      };
      // A lexical hit counts by the share of the query it covers: "сладкий" alone matching sweet vermouth
      // must not outrank what "тропический сладкий" means.
      const wordCount = Math.max(1, queryWords(query).length);
      for (const [i, h] of lexicalHits.entries()) {
        add(h.recipeId, i + 1, h.field, h.matched / wordCount);
      }

      let semantic = false;
      const { embedder } = deps;
      if (embedder) {
        try {
          const vector = await queryVector(embedder, query);
          if (vector) {
            const near = await deps.store.nearest(embedder.name, vector, CANDIDATES);
            const best = near[0]?.distance;
            const cutoff = lexicalHits.length > 0 ? MAX_DISTANCE : MAX_DISTANCE_WITHOUT_WORDS;
            if (best !== undefined && best <= cutoff) {
              semantic = true;
              const close = near.filter(
                (n) => n.distance <= Math.min(best + SEMANTIC_MARGIN, cutoff),
              );
              for (const [i, n] of close.entries()) add(n.recipeId, i + 1, 'meaning');
            }
          }
        } catch (error) {
          deps.logger.warn('semantic search failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const results = [...fused.values()]
        .filter((r) => index.recipes.has(r.id))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((r) => ({ ...r, score: Math.round(r.score * 10_000) / 10_000 }));
      return { semantic, results };
    },

    async indexCatalog() {
      const { embedder } = deps;
      if (!embedder) return { embedded: 0, failed: 0, kept: 0 };
      const known = await deps.store.hashes(embedder.name);
      const todo = [...index.recipes.values()]
        .flatMap((recipe) =>
          LOCALES.map((locale) => ({
            recipe,
            locale,
            text: recipeDocument(recipe, index, locale),
          })),
        )
        .map((d) => ({ ...d, hash: sha256(d.text) }))
        .filter((d) => known.get(`${d.recipe.id}:${d.locale}`) !== d.hash);
      let embedded = 0;
      const queue = [...todo];
      let failed = 0;
      let lastError: unknown;
      const worker = async () => {
        for (let d = queue.shift(); d; d = queue.shift()) {
          const doc = d;
          let result: { vector: number[]; tokens: number } | undefined;
          try {
            result = await charged(embedder, Math.ceil(doc.text.length / 3), () =>
              embedder.embed('doc', doc.text, AbortSignal.timeout(DOC_TIMEOUT_MS)),
            );
          } catch (error) {
            // One failed document (a rate limit, a timeout) is retried on the next start.
            failed++;
            lastError = error;
            continue;
          }
          if (!result) throw new Error('embedding budget exhausted');
          await deps.store.upsert({
            recipeId: doc.recipe.id,
            locale: doc.locale,
            model: embedder.name,
            textHash: doc.hash,
            vector: result.vector,
          });
          embedded++;
        }
      };
      await Promise.all(Array.from({ length: INDEX_CONCURRENCY }, worker));
      if (failed > 0) {
        deps.logger.warn('search index incomplete', {
          failed,
          error: lastError instanceof Error ? lastError.message : String(lastError),
        });
      }
      return { embedded, failed, kept: index.recipes.size * LOCALES.length - todo.length };
    },
  };
}

export function createPgEmbeddingStore(db: Database): EmbeddingStore {
  return {
    async hashes(model) {
      const rows = await db
        .select({
          recipeId: recipeEmbedding.recipeId,
          locale: recipeEmbedding.locale,
          textHash: recipeEmbedding.textHash,
        })
        .from(recipeEmbedding)
        .where(eq(recipeEmbedding.model, model));
      return new Map(rows.map((r) => [`${r.recipeId}:${r.locale}`, r.textHash]));
    },
    async upsert(row) {
      await db
        .insert(recipeEmbedding)
        .values({
          recipeId: row.recipeId,
          locale: row.locale,
          model: row.model,
          textHash: row.textHash,
          embedding: row.vector,
        })
        .onConflictDoUpdate({
          target: [recipeEmbedding.recipeId, recipeEmbedding.locale],
          set: {
            model: row.model,
            textHash: row.textHash,
            embedding: row.vector,
            updatedAt: sql`now()`,
          },
        });
    },
    async nearest(model, vector, limit) {
      // Each recipe once, at the distance of its closer language. 404 rows: an exact scan.
      const rows = await db.execute<{ recipe_id: string; distance: number }>(sql`
        SELECT recipe_id, min(${recipeEmbedding.embedding} <=> ${JSON.stringify(vector)}::vector) AS distance
        FROM ${recipeEmbedding}
        WHERE ${recipeEmbedding.model} = ${model}
        GROUP BY recipe_id
        ORDER BY distance
        LIMIT ${limit}`);
      return [...rows].map((r) => ({ recipeId: r.recipe_id, distance: Number(r.distance) }));
    },
  };
}

/** In-memory store for tests and the eval harness: exact cosine distance. */
export function createMemoryEmbeddingStore(): EmbeddingStore {
  const rows = new Map<
    string,
    { recipeId: string; model: string; textHash: string; vector: number[] }
  >();
  const cosineDistance = (a: number[], b: number[]) => {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      const x = a[i] ?? 0;
      const y = b[i] ?? 0;
      dot += x * y;
      na += x * x;
      nb += y * y;
    }
    return 1 - dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
  };
  return {
    async hashes(model) {
      return new Map(
        [...rows].filter(([, r]) => r.model === model).map(([key, r]) => [key, r.textHash]),
      );
    },
    async upsert(row) {
      rows.set(`${row.recipeId}:${row.locale}`, {
        recipeId: row.recipeId,
        model: row.model,
        textHash: row.textHash,
        vector: row.vector,
      });
    },
    async nearest(model, vector, limit) {
      const best = new Map<string, number>();
      for (const r of rows.values()) {
        if (r.model !== model) continue;
        const d = cosineDistance(vector, r.vector);
        if (d < (best.get(r.recipeId) ?? Number.POSITIVE_INFINITY)) best.set(r.recipeId, d);
      }
      return [...best]
        .map(([recipeId, distance]) => ({ recipeId, distance }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);
    },
  };
}
