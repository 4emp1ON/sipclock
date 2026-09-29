import { catalog as catalogSchema, type Ingredient } from '@sipclock/domain';
import { describe, expect, it } from 'vitest';
import { fixtureCatalog } from './__fixtures__/catalog.ts';
import { createIndex, satisfies } from './graph.ts';

const index = createIndex(fixtureCatalog);

describe('graph', () => {
  it('same id satisfies itself', () => {
    expect(satisfies('lime', 'lime', index)).toBe(true);
  });
  it('generic bar ingredient satisfies the specific need and vice versa', () => {
    expect(satisfies('gin', 'london-dry-gin', index)).toBe(true);
    expect(satisfies('london-dry-gin', 'gin', index)).toBe(true);
  });
  it('unrelated ingredients do not satisfy each other', () => {
    expect(satisfies('vodka', 'gin', index)).toBe(false);
    expect(satisfies('lemon', 'lime', index)).toBe(false); // substitutes are not hierarchy
  });
  it('unknown ids only match themselves', () => {
    expect(satisfies('unobtainium', 'gin', index)).toBe(false);
    expect(satisfies('unobtainium', 'unobtainium', index)).toBe(true);
  });
  it('builds ancestors and descendants', () => {
    expect(index.ancestors.get('london-dry-gin')).toEqual(['gin']);
    expect(index.descendants.get('gin')).toEqual(['london-dry-gin']);
  });
  it('survives parent cycles', () => {
    const cyclic = createIndex({
      ...fixtureCatalog,
      ingredients: [
        { ...(fixtureCatalog.ingredients[2] as Ingredient), id: 'a', parent: 'b' },
        { ...(fixtureCatalog.ingredients[2] as Ingredient), id: 'b', parent: 'a' },
      ],
    });
    expect(cyclic.ancestors.get('a')).toEqual(['b']);
  });
});

describe('madeFrom', () => {
  const tiny = catalogSchema.parse({
    version: '2026.09.29',
    ingredients: [
      { id: 'lemon', name: { en: 'Lemon', ru: 'Лимон' }, kind: 'fresh', abv: 0 },
      {
        id: 'lemon-juice',
        name: { en: 'Lemon juice', ru: 'Лимонный сок' },
        kind: 'juice',
        abv: 0,
        madeFrom: 'lemon',
      },
    ],
    recipes: [],
  });
  const idx = createIndex(tiny);

  it('a fresh lemon at home covers lemon juice, but not the other way round', () => {
    expect(satisfies('lemon', 'lemon-juice', idx)).toBe(true);
    expect(satisfies('lemon-juice', 'lemon', idx)).toBe(false);
  });
});
