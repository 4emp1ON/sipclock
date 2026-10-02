import { describe, expect, it, vi } from 'vitest';
import type { Embedder } from '../ai/providers.ts';
import { silentLogger } from '../lib/logger.ts';
import { createBundledCatalogService } from './catalog.ts';
import { createMemoryEmbeddingStore, createSearchService } from './search.ts';

const catalog = createBundledCatalogService();

// One axis per concept: a document or query points along the concepts it mentions.
const CONCEPTS = [/mint|мят/u, /pineapple|ананас|coconut|кокос/u, /hot|горяч|warm|соглев/u];
function fakeEmbedder(): Embedder & { calls: { kind: string; text: string }[] } {
  const calls: { kind: string; text: string }[] = [];
  return {
    calls,
    provider: 'yandex',
    name: 'fake/emb',
    pricePerToken: 1,
    async embed(kind, text) {
      calls.push({ kind, text });
      const lower = text.toLowerCase();
      // The last axis is nonsense: only gibberish points there, away from every recipe.
      const vector = [
        ...CONCEPTS.map((re) => (re.test(lower) ? 1 : 0)),
        0.01,
        lower.includes('zzzz') ? 1 : 0,
      ];
      return { vector, tokens: 10 };
    },
  };
}

function setup(opts: { embedder?: Embedder; fits?: boolean } = {}) {
  const spend = {
    reserveSpend: vi.fn(async () => opts.fits ?? true),
    settleSpend: vi.fn(async () => {}),
  };
  const service = createSearchService({
    catalog,
    store: createMemoryEmbeddingStore(),
    embedder: opts.embedder,
    spend,
    budget: 1_000_000,
    logger: silentLogger,
  });
  return { service, spend };
}

describe('createSearchService', () => {
  it('answers lexically without a provider', async () => {
    const { service } = setup();
    const out = await service.search('negroni', 5);
    expect(out.semantic).toBe(false);
    expect(out.results[0]).toMatchObject({ id: 'negroni', field: 'name' });
    expect(await service.indexCatalog()).toEqual({ embedded: 0, failed: 0, kept: 0 });
  });

  it('embeds each recipe once per language and only again when its text changes', async () => {
    const embedder = fakeEmbedder();
    const { service, spend } = setup({ embedder });
    const recipes = catalog.catalog.recipes.length;
    expect(await service.indexCatalog()).toEqual({ embedded: recipes * 2, failed: 0, kept: 0 });
    expect(await service.indexCatalog()).toEqual({ embedded: 0, failed: 0, kept: recipes * 2 });
    // Every call is charged against the monthly budget.
    expect(spend.settleSpend).toHaveBeenCalledTimes(recipes * 2);
  });

  it('adds recipes found only by meaning and marks them', async () => {
    const embedder = fakeEmbedder();
    const { service } = setup({ embedder });
    await service.indexCatalog();
    // No recipe has the word "coolness"; "mint" in the query embedding is what finds the mint drinks.
    const out = await service.search('coolness of mint leaves', 10);
    expect(out.semantic).toBe(true);
    expect(out.results.map((r) => r.id)).toContain('mojito');
  });

  it('caches query embeddings', async () => {
    const embedder = fakeEmbedder();
    const { service } = setup({ embedder });
    await service.indexCatalog();
    embedder.calls.length = 0;
    await service.search('Something  with MINT', 5);
    await service.search('something with mint', 5);
    expect(embedder.calls.filter((c) => c.kind === 'query')).toHaveLength(1);
  });

  it('falls back to lexical results past the budget or when the provider fails', async () => {
    const embedder = fakeEmbedder();
    const overBudget = setup({ embedder, fits: false });
    const out = await overBudget.service.search('negroni', 5);
    expect(out).toMatchObject({ semantic: false });
    expect(out.results[0]?.id).toBe('negroni');

    const failing: Embedder = {
      ...fakeEmbedder(),
      embed: async () => {
        throw new Error('rate limited');
      },
    };
    const broken = setup({ embedder: failing });
    expect(await broken.service.search('negroni', 5)).toMatchObject({ semantic: false });
  });

  it('finds nothing by meaning for gibberish that matches no word', async () => {
    const embedder = fakeEmbedder();
    const { service } = setup({ embedder });
    await service.indexCatalog();
    const out = await service.search('zzzzqx', 10);
    expect(out.results).toEqual([]);
  });
});
