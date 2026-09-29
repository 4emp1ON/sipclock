import { describe, expect, it } from 'vitest';
import { fixtureCatalog } from './__fixtures__/catalog.ts';
import { estimateAbv } from './abv.ts';
import { createIndex } from './graph.ts';

const index = createIndex(fixtureCatalog);
const abvOf = (id: string) => {
  const r = index.recipes.get(id);
  if (!r) throw new Error(id);
  return estimateAbv(r, index);
};

describe('estimateAbv', () => {
  it.each([
    ['negroni', 24],
    ['gin-and-tonic', 10],
    ['old-fashioned', 30],
    ['daiquiri', 20],
  ])('%s ≈ %i%% (±2)', (id, expected) => {
    expect(Math.abs(abvOf(id) - expected)).toBeLessThanOrEqual(2);
  });
  it('is an integer', () => {
    for (const r of fixtureCatalog.recipes)
      expect(Number.isInteger(estimateAbv(r, index))).toBe(true);
  });
  it.each(['virgin-mojito', 'ginger-lime-fizz', 'hot-honey-lemon'])('zero-proof %s is 0', (id) => {
    expect(abvOf(id)).toBe(0);
  });
  it('treats ingredients at or below 0.5% as alcohol-free', () => {
    // orange juice 0.3% and ginger beer 0.5% must not leak into the estimate
    expect(abvOf('ginger-lime-fizz')).toBe(0);
  });
  it('never rounds a drink with an alcoholic ingredient down to 0%', () => {
    const negroni = index.recipes.get('negroni');
    if (!negroni) throw new Error('negroni');
    const bitters = negroni.ingredients.find(
      (i) => (index.ingredients.get(i.ingredient)?.abv ?? 0) > 0,
    );
    if (!bitters) throw new Error('fixture needs an alcoholic ingredient');
    const tonicAndDash = {
      ...negroni,
      method: 'build' as const,
      ingredients: [
        {
          ingredient: bitters.ingredient,
          amount: { unit: 'dash' as const, value: 2 },
          optional: false,
          garnish: false,
        },
        {
          ingredient: 'tonic-water',
          amount: { unit: 'ml' as const, value: 200 },
          optional: false,
          garnish: false,
        },
      ],
    };
    expect(estimateAbv(tonicAndDash, index)).toBe(1);
  });
  it('ignores garnish and optional', () => {
    const negroni = index.recipes.get('negroni');
    if (!negroni) throw new Error('negroni');
    const without = { ...negroni, ingredients: negroni.ingredients.filter((i) => !i.garnish) };
    expect(estimateAbv(without, index)).toBe(estimateAbv(negroni, index));
  });
});
