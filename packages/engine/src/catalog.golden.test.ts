// Golden scenarios against the real curated catalog (the fixture tests cover the mechanics).
import { catalog } from '@sipclock/catalog';
import { describe, expect, it } from 'vitest';
import { estimateAbv } from './abv.ts';
import { createIndex } from './graph.ts';
import { input, moment } from './helpers.test-util.ts';
import { recommend } from './recommend.ts';

const index = createIndex(catalog);
const recipe = (id: string) => {
  const r = index.recipes.get(id);
  if (!r) throw new Error(`no recipe ${id}`);
  return r;
};

describe('real catalog: ABV', () => {
  it.each([
    ['negroni', 20, 28],
    ['old-fashioned', 25, 36],
    ['gin-and-tonic', 7, 13],
    ['daiquiri', 16, 24],
    ['mimosa', 5, 10],
  ])('%s is between %i%% and %i%%', (id, min, max) => {
    const abv = estimateAbv(recipe(id), index);
    expect(abv).toBeGreaterThanOrEqual(min);
    expect(abv).toBeLessThanOrEqual(max);
  });

  it('shows 0% exactly for recipes without alcoholic ingredients', () => {
    for (const r of catalog.recipes) {
      const hasAlcohol = r.ingredients.some(
        (i) => !i.optional && !i.garnish && (index.ingredients.get(i.ingredient)?.abv ?? 0) > 0.5,
      );
      expect({ id: r.id, zero: estimateAbv(r, index) === 0 }).toEqual({
        id: r.id,
        zero: !hasAlcohol,
      });
    }
  });
});

describe('real catalog: recommendations', () => {
  it('hot Friday aperitif with gin and tonic at home → Gin & Tonic, ready', () => {
    const rec = recommend(
      input({
        moment: moment({ weekday: 5, hour: 19 }),
        weather: { tempC: 27, condition: 'clear' },
        bar: ['gin', 'tonic-water', 'lemon'],
      }),
      catalog,
    );
    expect(rec.pick?.recipeId).toBe('gin-and-tonic');
    expect(rec.pick?.availability.status).toBe('ready');
    expect(rec.pick?.reasons.map((r) => r.code)).toContain('weather');
  });

  it('alcohol-free request never returns a drink with alcohol', () => {
    const rec = recommend(
      input({
        weather: { tempC: 27, condition: 'clear' },
        bar: ['tonic-water', 'lemon', 'lemon-juice', 'simple-syrup', 'soda-water'],
        alcoholFree: true,
      }),
      catalog,
    );
    expect(rec.pick).not.toBeNull();
    for (const r of [rec.pick, ...rec.alternatives]) expect(r?.abv).toBe(0);
  });

  it('cold rainy late evening with bourbon → a warming or spirit-forward drink', () => {
    const rec = recommend(
      input({
        moment: moment({ month: 1, day: 15, weekday: 4, hour: 22, minute: 30 }),
        weather: { tempC: 3, condition: 'rain' },
        bar: ['bourbon', 'aromatic-bitters', 'simple-syrup', 'honey-syrup', 'lemon', 'lemon-juice'],
      }),
      catalog,
    );
    const pick = recipe(rec.pick?.recipeId ?? '');
    expect(pick.tags.weather.some((w) => w === 'cold' || w === 'rainy')).toBe(true);
    expect(rec.pick?.availability.status).not.toBe('missing');
  });

  it('Sunday brunch → a brunch drink', () => {
    const rec = recommend(
      input({ moment: moment({ weekday: 0, hour: 11 }), occasion: 'brunch', bar: null }),
      catalog,
    );
    expect(recipe(rec.pick?.recipeId ?? '').tags.dayparts).toContain('brunch');
  });

  it('offers an alcohol-free alternative next to an alcoholic pick', () => {
    const rec = recommend(
      input({ weather: { tempC: 27, condition: 'clear' }, bar: ['gin', 'tonic-water', 'lemon'] }),
      catalog,
    );
    expect(rec.alternatives.some((a) => a.abv === 0)).toBe(true);
  });

  it('every seed yields a valid pick for a typical evening', () => {
    for (let seed = 0; seed < 50; seed++) {
      const rec = recommend(
        input({ seed, bar: ['gin', 'lemon', 'simple-syrup', 'soda-water'] }),
        catalog,
      );
      expect(rec.pick).not.toBeNull();
      expect(rec.catalogVersion).toBe(catalog.version);
    }
  });
});
