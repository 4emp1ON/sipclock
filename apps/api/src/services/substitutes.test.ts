import { createIndex } from '@sipclock/engine';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { type AiCaller, createAiGateway } from '../ai/gateway.ts';
import type { ModelRegistry } from '../ai/providers.ts';
import { createMemoryAiStore } from '../ai/store.ts';
import { silentLogger } from '../lib/logger.ts';
import { createBundledCatalogService } from './catalog.ts';
import {
  buildPrompt,
  catalogSuggestions,
  createSubstitutesService,
  MAX_CANDIDATES,
  MAX_RANKED,
  personalize,
  type RankedPick,
  type SubstituteCandidate,
  sanitizePicks,
  substituteCandidates,
} from './substitutes.ts';

const catalog = createBundledCatalogService();
const index = createIndex(catalog.catalog);

describe('substituteCandidates', () => {
  it('lists curated substitutes first and ignores the bar', () => {
    const out = substituteCandidates(index, 'gin', 'en');
    expect(out[0]).toEqual({
      id: 'vodka',
      curated: true,
      loose: false,
      note: 'Less botanical, still works',
    });
    expect(out.map((c) => c.id)).not.toContain('tequila');
  });

  it('uses the locale for curated notes', () => {
    expect(substituteCandidates(index, 'gin', 'ru')[0]?.note).toBe('Меньше трав, но подойдёт');
  });

  it('excludes the ingredient itself, its ancestors and descendants, and has no duplicates', () => {
    // bourbon -> parent whisky; rye-whiskey is both curated and a sibling.
    const out = substituteCandidates(index, 'bourbon', 'en');
    const ids = out.map((c) => c.id);
    expect(ids).not.toContain('bourbon');
    expect(ids).not.toContain('whisky');
    expect(new Set(ids).size).toBe(ids.length);
    expect(out[0]).toMatchObject({ id: 'rye-whiskey', curated: true });
    expect(ids).toEqual(expect.arrayContaining(['scotch-whisky', 'irish-whiskey']));

    // gin has a descendant, which must not be offered as its substitute.
    expect(substituteCandidates(index, 'gin', 'en').map((c) => c.id)).not.toContain(
      'london-dry-gin',
    );
  });

  it('returns only catalog ingredients and respects the cap', () => {
    for (const id of index.ingredients.keys()) {
      const out = substituteCandidates(index, id, 'en');
      expect(out.length).toBeLessThanOrEqual(MAX_CANDIDATES);
      for (const c of out) expect(index.ingredients.has(c.id)).toBe(true);
    }
    expect(substituteCandidates(index, 'not-an-ingredient', 'en')).toEqual([]);
  });
});

describe('buildPrompt', () => {
  it('is compact: ids instead of names, no garnish or staples, editors picks marked', () => {
    const recipe = index.recipes.get('negroni');
    if (!recipe) throw new Error('negroni missing');
    const prompt = buildPrompt(
      recipe,
      'gin',
      substituteCandidates(index, 'gin', 'en'),
      index,
      'en',
    );
    expect(prompt).toContain('Missing: gin');
    expect(prompt).toContain('vodka* (Less botanical, still works)');
    expect(prompt).not.toMatch(/\bice\b|orange/);
    expect(prompt.length).toBeLessThan(300);
  });
});

describe('personalize', () => {
  const pick = (ingredientId: string, fit: 'close' | 'workable'): RankedPick => ({
    ingredientId,
    fit,
  });

  it('puts close matches first, then what is at home, then the ranking order; caps at 3', () => {
    const picks = [
      pick('irish-whiskey', 'workable'),
      pick('rye-whiskey', 'close'),
      pick('scotch-whisky', 'workable'),
      pick('vodka', 'workable'),
    ];
    const out = personalize(picks, new Set(['vodka']), index);
    expect(out.map((s) => [s.ingredientId, s.inBar])).toEqual([
      ['rye-whiskey', false],
      ['vodka', true],
      ['irish-whiskey', false],
    ]);
  });

  it('counts the bar through the hierarchy (a generic parent covers its children)', () => {
    const out = personalize([pick('scotch-whisky', 'close')], new Set(['whisky']), index);
    expect(out[0]?.inBar).toBe(true);
  });
});

describe('catalogSuggestions', () => {
  const candidates: SubstituteCandidate[] = [
    { id: 'rye-whiskey', curated: true, loose: false, note: 'Drier' },
    { id: 'scotch-whisky', curated: false, loose: false, note: undefined },
    { id: 'irish-whiskey', curated: false, loose: false, note: undefined },
  ];

  it('keeps curated candidates and related ones the user has, close before workable', () => {
    expect(catalogSuggestions(candidates, new Set(['irish-whiskey']), index)).toEqual([
      { ingredientId: 'rye-whiskey', inBar: false, fit: 'close', note: 'Drier' },
      { ingredientId: 'irish-whiskey', inBar: true, fit: 'workable' },
    ]);
    expect(catalogSuggestions(candidates, new Set(), index).map((s) => s.ingredientId)).toEqual([
      'rye-whiskey',
    ]);
  });

  it('offers loose curated swaps as workable, never close', () => {
    const loose: SubstituteCandidate = {
      id: 'soda-water',
      curated: true,
      loose: true,
      note: 'No bite',
    };
    expect(catalogSuggestions([loose], new Set(), index)).toEqual([
      { ingredientId: 'soda-water', inBar: false, fit: 'workable', note: 'No bite' },
    ]);
  });
});

describe('sanitizePicks', () => {
  const candidates: SubstituteCandidate[] = 'abcdefgh'.split('').map((id) => ({
    id,
    curated: id === 'a',
    loose: false,
    note: id === 'a' ? 'Curated A' : undefined,
  }));
  const raw = (ingredientId: string, note: string, fit: 'close' | 'workable' = 'close') => ({
    ingredientId,
    fit,
    note,
  });

  it('drops unknown and duplicate ids and caps the ranking', () => {
    const out = sanitizePicks(
      [
        raw('zzz', 'Fine note'),
        raw('a', 'Fine note'),
        raw('a', 'Again'),
        ...'bcdefgh'.split('').map((id) => raw(id, 'Fine note')),
      ],
      candidates,
      'en',
    );
    expect(out).toHaveLength(MAX_RANKED);
    expect(out.map((s) => s.ingredientId)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(out[0]).toEqual({ ingredientId: 'a', fit: 'close', note: 'Fine note' });
  });

  it('keeps the model fit and cleans the note', () => {
    const [s] = sanitizePicks(
      [raw('b', 'Sweeter, see https://x.test now', 'workable')],
      candidates,
      'en',
    );
    expect(s).toEqual({ ingredientId: 'b', fit: 'workable', note: 'Sweeter, see now' });
  });

  it('replaces a branded or wrong-language note with the curated note, or drops it', () => {
    const out = sanitizePicks(
      [raw('a', 'Use Aperol here'), raw('b', 'Use Aperol here'), raw('d', 'Меньше трав')],
      candidates,
      'en',
    );
    expect(out).toEqual([
      { ingredientId: 'a', fit: 'close', note: 'Curated A' },
      { ingredientId: 'b', fit: 'close' },
      { ingredientId: 'd', fit: 'close' },
    ]);
  });

  it('treats an empty note as unusable', () => {
    expect(sanitizePicks([raw('a', '  ')], candidates, 'en')[0]?.note).toBe('Curated A');
  });
});

// A recipe with gin (curated substitute: vodka) and an optional/garnish line to test canSkip.
const RECIPE = 'negroni';

function modelReturning(json: unknown) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text: JSON.stringify(json) }],
      finishReason: { unified: 'stop', raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 20, text: 20, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

function setupService(model: MockLanguageModelV4 | undefined) {
  const store = createMemoryAiStore();
  const registry: ModelRegistry = {
    get: (p) =>
      model && p === 'yandex'
        ? { provider: 'yandex', name: 'yandex/test', model, price: { input: 1, output: 2 } }
        : undefined,
    budgets: { yandex: 1_000_000_000, anthropic: 0 },
  };
  const gateway = createAiGateway({
    registry,
    store,
    logger: silentLogger,
    dailyLimits: { free: 5 },
  });
  return { service: createSubstitutesService(catalog, gateway), store };
}

const caller: AiCaller = { userId: 'u1', country: undefined, locale: 'en', requestId: 'r' };
const query = { recipeId: RECIPE, ingredientId: 'gin', bar: ['vodka'], locale: 'en' as const };

describe('createSubstitutesService', () => {
  it('reports unknown recipes and ingredients outside the recipe', async () => {
    const { service } = setupService(undefined);
    expect(await service.suggest({ ...query, recipeId: 'nope' }, caller)).toEqual({
      ok: false,
      error: 'unknown-recipe',
    });
    expect(await service.suggest({ ...query, ingredientId: 'tequila' }, caller)).toEqual({
      ok: false,
      error: 'not-in-recipe',
    });
  });

  it('answers from the model, sanitised, and caches the answer', async () => {
    const model = modelReturning({
      suggestions: [
        { ingredientId: 'vodka', fit: 'workable', note: 'Cleaner and less botanical' },
        { ingredientId: 'vodka', fit: 'close', note: 'dup' },
      ],
      canSkip: false,
    });
    const { service } = setupService(model);
    const first = await service.suggest(query, caller);
    expect(first).toEqual({
      ok: true,
      remaining: 4,
      result: {
        recipeId: RECIPE,
        ingredientId: 'gin',
        source: 'ai',
        suggestions: [
          {
            ingredientId: 'vodka',
            inBar: true,
            fit: 'workable',
            note: 'Cleaner and less botanical',
          },
        ],
        canSkip: false,
      },
    });
    const second = await service.suggest(query, caller);
    expect(second).toMatchObject({ ok: true, remaining: null, result: { source: 'ai' } });
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it('shares one cached ranking across bars and fits it to each bar', async () => {
    const model = modelReturning({
      suggestions: [{ ingredientId: 'vodka', fit: 'close', note: 'Works' }],
      canSkip: false,
    });
    const { service } = setupService(model);
    await service.suggest(query, caller);
    const other = await service.suggest({ ...query, bar: [] }, { ...caller, userId: 'u2' });
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(other).toMatchObject({
      remaining: null,
      result: { source: 'ai', suggestions: [{ ingredientId: 'vodka', inBar: false }] },
    });
  });

  it('falls back to the catalog when the model fails', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error('outage');
      },
    });
    const { service, store } = setupService(model);
    const out = await service.suggest(query, caller);
    expect(out).toMatchObject({
      ok: true,
      result: {
        source: 'catalog',
        suggestions: [
          { ingredientId: 'vodka', inBar: true, fit: 'close', note: 'Less botanical, still works' },
        ],
      },
    });
    expect(store.usage.get(`u1:${new Date().toISOString().slice(0, 10)}`)?.requests).toBe(1);
  });

  it('charges the reported usage when the model output does not parse', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: 'text', text: '{"suggestions":[{"ingredientId":"vod' }],
        finishReason: { unified: 'length', raw: undefined },
        usage: {
          inputTokens: { total: 1000, noCache: 1000, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 500, text: 500, reasoning: undefined },
        },
        warnings: [],
      }),
    });
    const { service, store } = setupService(model);
    const out = await service.suggest(query, caller);
    expect(out).toMatchObject({ ok: true, result: { source: 'catalog' } });
    const day = new Date().toISOString().slice(0, 10);
    expect(store.usage.get(`u1:${day}`)).toEqual({ requests: 1, input: 1000, output: 500 });
    // price { input: 1, output: 2 } per token
    expect(store.spend.get(`yandex:${day.slice(0, 7)}-01`)).toEqual({ reserved: 0, spent: 2000 });
  });

  it('falls back to the catalog when the model suggests nothing usable', async () => {
    const { service } = setupService(modelReturning({ suggestions: [], canSkip: true }));
    const out = await service.suggest(query, caller);
    expect(out).toMatchObject({ ok: true, result: { source: 'catalog' } });
  });

  it('skips the model when the gateway is disabled', async () => {
    const { service } = setupService(undefined);
    expect(await service.suggest(query, caller)).toMatchObject({
      ok: true,
      remaining: null,
      result: { source: 'catalog', canSkip: false },
    });
  });

  it('lets the model mark a required ingredient as skippable', async () => {
    const { service } = setupService(
      modelReturning({
        suggestions: [{ ingredientId: 'vodka', fit: 'close', note: 'Works' }],
        canSkip: true,
      }),
    );
    expect(await service.suggest(query, caller)).toMatchObject({
      result: { source: 'ai', canSkip: true },
    });
  });
});
