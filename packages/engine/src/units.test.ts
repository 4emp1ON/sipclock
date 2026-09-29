import type { Recipe } from '@sipclock/domain';
import { describe, expect, it } from 'vitest';
import { fixtureCatalog } from './__fixtures__/catalog.ts';
import { partsBase, scaleAmount, toDisplay } from './units.ts';

describe('scaleAmount', () => {
  it('scales linearly', () => {
    expect(scaleAmount({ unit: 'ml', value: 30 }, 4)).toEqual({ unit: 'ml', value: 120 });
    expect(scaleAmount({ unit: 'dash', value: 2 }, 3)).toEqual({ unit: 'dash', value: 6 });
    expect(scaleAmount({ unit: 'barspoon', value: 1 }, 2)).toEqual({ unit: 'barspoon', value: 2 });
    expect(scaleAmount({ unit: 'piece', value: 1 }, 5)).toEqual({ unit: 'piece', value: 5 });
    expect(scaleAmount({ unit: 'top', estimateMl: 60 }, 2)).toEqual({
      unit: 'top',
      estimateMl: 120,
    });
  });
  it('leaves fill unchanged', () => {
    expect(scaleAmount({ unit: 'fill' }, 8)).toEqual({ unit: 'fill' });
  });
});

describe('toDisplay', () => {
  it('converts ml to the nearest quarter oz', () => {
    expect(toDisplay({ unit: 'ml', value: 60 }, 'oz')).toEqual({ unit: 'oz', value: 2 });
    expect(toDisplay({ unit: 'ml', value: 45 }, 'oz')).toEqual({ unit: 'oz', value: 1.5 });
    expect(toDisplay({ unit: 'ml', value: 22 }, 'oz')).toEqual({ unit: 'oz', value: 0.75 });
  });
  it('keeps tiny amounts in ml instead of rounding to 0 oz', () => {
    expect(toDisplay({ unit: 'ml', value: 2 }, 'oz')).toEqual({ unit: 'ml', value: 2 });
  });
  it('expresses parts relative to the smallest non-garnish ml amount', () => {
    const negroni = fixtureCatalog.recipes.find((r) => r.id === 'daiquiri');
    if (!negroni) throw new Error('daiquiri');
    const base = partsBase(negroni);
    expect(base).toBe(15);
    expect(toDisplay({ unit: 'ml', value: 60 }, 'parts', { partsBase: base })).toEqual({
      unit: 'parts',
      value: 4,
    });
    expect(toDisplay({ unit: 'ml', value: 25 }, 'parts', { partsBase: base })).toEqual({
      unit: 'parts',
      value: 1.5,
    });
  });
  it('passes non-ml units through', () => {
    for (const system of ['ml', 'oz', 'parts'] as const) {
      expect(toDisplay({ unit: 'dash', value: 2 }, system, { partsBase: 10 })).toEqual({
        unit: 'dash',
        value: 2,
      });
      expect(toDisplay({ unit: 'fill' }, system)).toEqual({ unit: 'fill' });
    }
  });
  it('ignores garnish when picking the parts base', () => {
    expect(
      partsBase({
        ...(fixtureCatalog.recipes[0] as Recipe),
        ingredients: [
          { ingredient: 'gin', amount: { unit: 'ml', value: 40 }, optional: false, garnish: false },
          { ingredient: 'lime', amount: { unit: 'ml', value: 2 }, optional: false, garnish: true },
        ],
      }),
    ).toBe(40);
  });
});
