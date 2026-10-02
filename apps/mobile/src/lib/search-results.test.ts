import { catalog, recipesById } from '@sipclock/catalog';
import { createRecipeSearcher } from '@sipclock/engine';
import { catalogIndex } from './makeable';
import {
  browseRecipes,
  filterHits,
  matchesFilters,
  mergeHits,
  NO_FILTERS,
  type ResultHit,
} from './search-results';

const index = catalogIndex();
const recipe = (id: string) => {
  const r = recipesById.get(id);
  if (!r) throw new Error(`no recipe ${id}`);
  return r;
};
const on = (k: keyof typeof NO_FILTERS) => ({ ...NO_FILTERS, [k]: true });

describe('matchesFilters', () => {
  it('passes everything with no filters', () => {
    expect(matchesFilters(recipe('negroni'), NO_FILTERS, [], index)).toBe(true);
  });

  it('canMake: ready and swap pass, missing fails, unknown bar excludes nothing', () => {
    const gt = recipe('gin-and-tonic');
    expect(matchesFilters(gt, on('canMake'), ['gin', 'tonic-water'], index)).toBe(true);
    expect(matchesFilters(gt, on('canMake'), ['vodka'], index)).toBe(false);
    expect(matchesFilters(gt, on('canMake'), null, index)).toBe(true);
  });

  it('glass: highball only', () => {
    const highball = catalog.recipes.find((r) => r.glass === 'highball');
    const other = catalog.recipes.find((r) => r.glass !== 'highball');
    if (!highball || !other) throw new Error('catalog lacks glasses');
    expect(matchesFilters(highball, on('highball'), [], index)).toBe(true);
    expect(matchesFilters(other, on('highball'), [], index)).toBe(false);
  });

  it('alcohol free and under 15% follow the estimated ABV', () => {
    const strong = recipe('negroni');
    expect(matchesFilters(strong, on('alcoholFree'), [], index)).toBe(false);
    expect(matchesFilters(strong, on('under15'), [], index)).toBe(false);
    const free = catalog.recipes.find((r) => matchesFilters(r, on('alcoholFree'), [], index));
    if (!free) throw new Error('catalog has no alcohol-free drink');
    expect(matchesFilters(free, on('under15'), [], index)).toBe(true);
  });
});

describe('mergeHits', () => {
  const local = createRecipeSearcher(index).search('negroni');

  it('keeps local hits without an API answer', () => {
    expect(mergeHits(local, null)[0]?.id).toBe('negroni');
  });

  it('replaces the order with the API answer', () => {
    const api = [
      { id: 'gin-and-tonic', score: 1, field: 'meaning' as const },
      { id: 'negroni', score: 0.5, field: 'name' as const },
    ];
    expect(mergeHits(local, api)).toEqual([
      { id: 'gin-and-tonic', field: 'meaning' },
      { id: 'negroni', field: 'name' },
    ]);
  });

  it('falls back to local when the API has nothing usable', () => {
    expect(mergeHits(local, [])[0]?.id).toBe('negroni');
    expect(mergeHits(local, [{ id: 'nope', score: 1, field: 'name' }])[0]?.id).toBe('negroni');
  });
});

describe('filterHits', () => {
  it('applies filters over results and keeps order', () => {
    const hits: ResultHit[] = [
      { id: 'negroni', field: 'name' },
      { id: 'gin-and-tonic', field: 'name' },
      { id: 'ghost', field: 'name' },
    ];
    const out = filterHits(hits, on('canMake'), ['gin', 'tonic-water'], index);
    expect(out.map((h) => h.id)).toEqual(['gin-and-tonic']);
  });
});

describe('browseRecipes', () => {
  it('puts makeable drinks first and caps the list', () => {
    const out = browseRecipes(catalog.recipes, NO_FILTERS, ['gin', 'tonic-water'], index, 5);
    expect(out).toHaveLength(5);
    expect(out.map((r) => r.id)).toContain('gin-and-tonic');
  });
});
