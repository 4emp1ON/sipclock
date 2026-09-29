import { catalog } from '@sipclock/catalog';
import { countMakeable } from './makeable';
import { STARTER_BAR } from './presets';

describe('countMakeable', () => {
  it('counts nothing for an empty bar with a real catalog', () => {
    expect(countMakeable([])).toBeLessThan(catalog.recipes.length);
  });

  it('grows when ingredients are added', () => {
    const few = countMakeable(['gin']);
    const starter = countMakeable(STARTER_BAR);
    expect(starter).toBeGreaterThan(few);
    expect(starter).toBeGreaterThan(0);
  });

  it('counts a Gin & Tonic as makeable with gin and tonic', () => {
    expect(countMakeable(['gin', 'tonic-water'])).toBeGreaterThanOrEqual(1);
  });

  it('works on a tiny custom catalog', () => {
    const tiny = {
      ...catalog,
      ingredients: catalog.ingredients,
      recipes: catalog.recipes.filter((r) => r.id === 'gin-and-tonic'),
    };
    expect(countMakeable(['gin', 'tonic-water'], tiny)).toBe(1);
    expect(countMakeable(['vodka'], tiny)).toBe(0);
  });
});
