import { describe, expect, it } from 'vitest';
import { fixtureCatalog } from './__fixtures__/catalog.ts';
import { availability } from './availability.ts';
import { createIndex } from './graph.ts';

const index = createIndex(fixtureCatalog);
const get = (id: string) => {
  const r = index.recipes.get(id);
  if (!r) throw new Error(id);
  return r;
};

describe('availability', () => {
  it('unknown when the bar is null', () => {
    expect(availability(get('negroni'), null, index)).toEqual({ status: 'unknown' });
  });
  it('ready, staples are free and garnish is ignored', () => {
    const bar = ['gin', 'campari', 'sweet-vermouth']; // no orange garnish, no ice
    expect(availability(get('negroni'), bar, index)).toEqual({ status: 'ready' });
  });
  it('specific bar ingredient covers generic need', () => {
    expect(
      availability(get('gin-and-tonic'), ['london-dry-gin', 'tonic-water', 'lime'], index),
    ).toEqual({ status: 'ready' });
  });
  it('swaps a missing ingredient for a substitute in the bar', () => {
    expect(
      availability(get('gin-and-tonic'), ['london-dry-gin', 'tonic-water', 'lemon'], index),
    ).toEqual({ status: 'swap', swaps: [{ need: 'lime', use: 'lemon' }] });
  });
  it('missing lists what cannot be replaced, plus swaps', () => {
    expect(availability(get('gin-and-tonic'), ['lemon'], index)).toEqual({
      status: 'missing',
      missing: ['gin', 'tonic-water'],
      swaps: [{ need: 'lime', use: 'lemon' }],
    });
  });
  it('optional ingredients never make a recipe missing', () => {
    const base = get('negroni');
    const recipe = {
      ...base,
      ingredients: [
        ...base.ingredients,
        {
          ingredient: 'mint',
          amount: { unit: 'piece' as const, value: 1 },
          optional: true,
          garnish: false,
        },
      ],
    };
    expect(availability(recipe, ['gin', 'campari', 'sweet-vermouth'], index).status).toBe('ready');
  });
  it('accepts a Set as bar', () => {
    expect(
      availability(get('mimosa'), new Set(['sparkling-wine', 'orange-juice']), index).status,
    ).toBe('ready');
  });
});
