import { describe, expect, it } from 'vitest';
import { catalog, recipe } from './catalog.ts';

const gin = { id: 'gin', name: { en: 'Gin', ru: 'Джин' }, kind: 'spirit', abv: 40 };

const gAndT = {
  id: 'gin-and-tonic',
  name: { en: 'Gin & Tonic', ru: 'Джин-тоник' },
  description: { en: 'A light aperitif.', ru: 'Лёгкий аперитив.' },
  glass: 'highball',
  method: 'build',
  ingredients: [{ ingredient: 'gin', amount: { unit: 'ml', value: 50 } }],
  steps: [{ en: 'Build over ice.', ru: 'Соберите со льдом.' }],
  tags: { occasions: ['after-work'], flavors: ['fresh'], dayparts: ['aperitif'], weather: ['hot'] },
  difficulty: 1,
  timeMinutes: 2,
};

describe('catalog schema', () => {
  it('accepts a minimal valid catalog and fills defaults', () => {
    const parsed = catalog.parse({ version: '2026.09.29', ingredients: [gin], recipes: [gAndT] });
    expect(parsed.ingredients[0]?.staple).toBe(false);
    expect(parsed.recipes[0]?.ingredients[0]?.optional).toBe(false);
  });

  it('rejects non-kebab ids and empty translations', () => {
    expect(recipe.safeParse({ ...gAndT, id: 'Gin Tonic' }).success).toBe(false);
    expect(recipe.safeParse({ ...gAndT, name: { en: 'Gin & Tonic', ru: '' } }).success).toBe(false);
  });

  it('requires a calendar version', () => {
    expect(catalog.safeParse({ version: 'v1', ingredients: [], recipes: [] }).success).toBe(false);
  });
});
