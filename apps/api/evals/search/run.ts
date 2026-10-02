// Retrieval eval for recipe search (docs/adr/0009): hit@5 and recall@5 of the lexical searcher, semantic
// similarity alone and the hybrid the API serves, over natural-language queries in English and Russian.
// Expected answers are rules over the catalog, not hand-picked ids, so they follow catalog changes.
//
//   node --env-file=.env evals/search/run.ts            # live embeddings (document vectors cached on disk)
//   EVALS_MOCK=1 node evals/search/run.ts               # no provider: lexical only, checks the harness
//
// Exits non-zero when the hybrid's hit@5 falls below MIN_HYBRID_HIT_RATE.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Recipe } from '@sipclock/domain';
import { type CatalogIndex, createIndex, estimateAbv } from '@sipclock/engine';
import { createEmbedder, type Embedder } from '../../src/ai/providers.ts';
import { silentLogger } from '../../src/lib/logger.ts';
import { createBundledCatalogService } from '../../src/services/catalog.ts';
import { createMemoryEmbeddingStore, createSearchService } from '../../src/services/search.ts';

const MIN_HYBRID_HIT_RATE = 0.85;
const K = 5;
const CACHE_FILE = join(import.meta.dirname, '.cache', 'embeddings.json');

const catalog = createBundledCatalogService(process.env.CATALOG_DIR);
const index = createIndex(catalog.catalog);
const recipes = [...index.recipes.values()];

type Rule = (r: Recipe, index: CatalogIndex) => boolean;
const uses =
  (...ids: string[]): Rule =>
  (r, idx) =>
    r.ingredients.some(
      (l) =>
        !l.garnish &&
        (ids.includes(l.ingredient) ||
          (idx.ancestors.get(l.ingredient) ?? []).some((a) => ids.includes(a))),
    );
const named =
  (...ids: string[]): Rule =>
  (r) =>
    ids.includes(r.id);
const flavor =
  (f: string): Rule =>
  (r) =>
    (r.tags.flavors as string[]).includes(f);
const all =
  (...rules: Rule[]): Rule =>
  (r, idx) =>
    rules.every((rule) => rule(r, idx));
const any =
  (...rules: Rule[]): Rule =>
  (r, idx) =>
    rules.some((rule) => rule(r, idx));
const zeroProof: Rule = (r, idx) => estimateAbv(r, idx) === 0;
const hot: Rule = (r) => r.method === 'heat';
const tropical = any(
  uses(
    'pineapple-juice',
    'cream-of-coconut',
    'coconut-cream',
    'passion-fruit-puree',
    'passion-fruit-syrup',
    'orgeat',
  ),
  flavor('tropical'),
);
const mint = uses('mint', 'mint-liqueur');
const bitterAperitif = any(
  uses('red-bitter-aperitif', 'orange-aperitivo', 'gentian-liqueur'),
  named('americano', 'adonis', 'bamboo'),
);
const coffee = uses('espresso', 'brewed-coffee', 'coffee-liqueur', 'cold-brew-concentrate');
const bubbles = uses('sparkling-wine', 'alcohol-free-sparkling-wine');
const smoky = uses('mezcal', 'peated-scotch-whisky');
const creamy = uses(
  'cream',
  'cream-liqueur',
  'egg-liqueur',
  'condensed-milk',
  'cream-of-coconut',
  'coconut-cream',
  'milk',
);

const cases: { q: string; rule: Rule }[] = [
  { q: 'negroni', rule: named('negroni') },
  { q: 'негрони', rule: named('negroni') },
  { q: 'whisky sour', rule: named('whiskey-sour') },
  { q: 'classic dry martini', rule: named('dry-martini') },
  { q: 'something refreshing with mint', rule: mint },
  { q: 'что-то освежающее с мятой', rule: mint },
  { q: 'bitter aperitif before dinner', rule: bitterAperitif },
  { q: 'горький аперитив перед ужином', rule: bitterAperitif },
  { q: 'tropical and sweet', rule: tropical },
  { q: 'тропический сладкий', rule: tropical },
  { q: 'something warm for a cold evening', rule: hot },
  { q: 'что-нибудь согревающее', rule: hot },
  { q: 'alcohol-free and sour', rule: all(zeroProof, flavor('sour')) },
  { q: 'безалкогольное кислое', rule: all(zeroProof, flavor('sour')) },
  { q: 'coffee cocktail', rule: coffee },
  { q: 'кофейный коктейль', rule: coffee },
  { q: 'festive with bubbles', rule: bubbles },
  { q: 'праздничное с пузырьками', rule: bubbles },
  { q: 'tequila', rule: uses('tequila') },
  { q: 'с текилой', rule: uses('tequila') },
  { q: 'smoky', rule: smoky },
  { q: 'дымный', rule: smoky },
  { q: 'creamy dessert drink', rule: creamy },
  { q: 'сливочный десертный', rule: creamy },
  { q: 'gin and lemon', rule: all(uses('gin'), uses('lemon-juice', 'lemon')) },
  { q: 'джин и лимон', rule: all(uses('gin'), uses('lemon-juice', 'lemon')) },
];

/** Document vectors cached by text hash, so a rerun costs only the query embeddings. */
function cachedEmbedder(inner: Embedder): Embedder {
  let cache: Record<string, number[]> = {};
  try {
    cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as Record<string, number[]>;
  } catch {
    // First run.
  }
  return {
    ...inner,
    async embed(kind, text, signal) {
      if (kind !== 'doc') return inner.embed(kind, text, signal);
      const key = createHash('sha256').update(`${inner.name}\n${text}`).digest('hex');
      const hit = cache[key];
      if (hit) return { vector: hit, tokens: 0 };
      const out = await inner.embed(kind, text, signal);
      cache[key] = out.vector;
      mkdirSync(dirname(CACHE_FILE), { recursive: true });
      writeFileSync(CACHE_FILE, JSON.stringify(cache));
      return out;
    },
  };
}

const live = process.env.EVALS_MOCK !== '1' ? createEmbedder(process.env as never) : undefined;
const embedder = live ? cachedEmbedder(live) : undefined;
const spend = { reserveSpend: async () => true, settleSpend: async () => {} };
const store = createMemoryEmbeddingStore();
const hybrid = createSearchService({
  catalog,
  store,
  embedder,
  spend,
  budget: 1,
  logger: silentLogger,
});
const lexicalOnly = createSearchService({
  catalog,
  store,
  embedder: undefined,
  spend,
  budget: 1,
  logger: silentLogger,
});
if (embedder) {
  const r = await hybrid.indexCatalog();
  console.log(`index: ${JSON.stringify(r)}`);
}

async function semanticOnly(q: string): Promise<string[]> {
  if (!embedder) return [];
  const { vector } = await embedder.embed('query', q.toLowerCase());
  return (await store.nearest(embedder.name, vector, K)).map((n) => n.recipeId);
}

type Mode = 'lexical' | 'semantic' | 'hybrid';
const totals: Record<Mode, { hit: number; recall: number }> = {
  lexical: { hit: 0, recall: 0 },
  semantic: { hit: 0, recall: 0 },
  hybrid: { hit: 0, recall: 0 },
};
const rows: string[] = [];
for (const { q, rule } of cases) {
  const expected = new Set(recipes.filter((r) => rule(r, index)).map((r) => r.id));
  if (expected.size === 0) throw new Error(`no recipe satisfies the rule for "${q}"`);
  const tops: Record<Mode, string[]> = {
    lexical: (await lexicalOnly.search(q, K)).results.map((r) => r.id),
    semantic: await semanticOnly(q),
    hybrid: (await hybrid.search(q, K)).results.map((r) => r.id),
  };
  const cells: string[] = [];
  for (const mode of Object.keys(totals) as Mode[]) {
    const found = tops[mode].filter((id) => expected.has(id)).length;
    totals[mode].hit += found > 0 ? 1 : 0;
    totals[mode].recall += found / Math.min(K, expected.size);
    cells.push(`${mode[0]}:${found}/${Math.min(K, expected.size)}`);
  }
  rows.push(`${cells.join(' ')}  ${q}  → ${tops.hybrid.join(', ')}`);
}

console.log(rows.join('\n'));
const n = cases.length;
for (const mode of Object.keys(totals) as Mode[]) {
  if (mode === 'semantic' && !embedder) continue;
  const t = totals[mode];
  console.log(
    `${mode.padEnd(8)} hit@${K} ${(t.hit / n).toFixed(2)}  recall@${K} ${(t.recall / n).toFixed(2)}`,
  );
}
const hybridHit = totals.hybrid.hit / n;
if (embedder && hybridHit < MIN_HYBRID_HIT_RATE) {
  console.error(`hybrid hit@${K} ${hybridHit.toFixed(2)} is below ${MIN_HYBRID_HIT_RATE}`);
  process.exit(1);
}
