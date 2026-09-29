import type { Reason } from '@sipclock/domain';
import { describe, expect, it } from 'vitest';
import { fixtureCatalog } from './__fixtures__/catalog.ts';
import { input, moment } from './helpers.test-util.ts';
import { recommend } from './recommend.ts';
import { RULES_VERSION } from './rules.ts';

const codes = (reasons: Reason[]) => reasons.map((r) => r.code);

describe('recommend: golden scenarios', () => {
  it('Friday 19:00, +27 clear, gin/tonic/lemon → Gin & Tonic with lime→lemon swap', () => {
    const rec = recommend(
      input({
        moment: moment({ month: 7, weekday: 5, hour: 19 }),
        weather: { tempC: 27, condition: 'clear' },
        bar: ['london-dry-gin', 'tonic-water', 'lemon'],
        seed: 7,
      }),
      fixtureCatalog,
    );
    expect(rec.pick?.recipeId).toBe('gin-and-tonic');
    expect(rec.pick?.availability).toEqual({
      status: 'swap',
      swaps: [{ need: 'lime', use: 'lemon' }],
    });
    expect(rec.pick?.reasons).toContainEqual({ code: 'swap', need: 'lime', use: 'lemon' });
    expect(rec.pick?.reasons).toContainEqual({ code: 'weather', fit: 'hot' });
    expect(rec.pick?.reasons).toContainEqual({ code: 'daypart', daypart: 'evening' });
    expect(rec.pick?.reasons.length).toBeLessThanOrEqual(4);
    expect(rec.catalogVersion).toBe(fixtureCatalog.version);
    expect(rec.rulesVersion).toBe(RULES_VERSION);
  });

  it('winter 22:30 rain, bourbon/bitters/sugar → Old Fashioned for weather and daypart', () => {
    const rec = recommend(
      input({
        moment: moment({ month: 1, day: 14, weekday: 3, hour: 22, minute: 30 }),
        weather: { tempC: 3, condition: 'rain' },
        bar: ['bourbon', 'angostura-bitters', 'sugar'],
        seed: 3,
      }),
      fixtureCatalog,
    );
    expect(rec.pick?.recipeId).toBe('old-fashioned');
    expect(rec.pick?.availability).toEqual({ status: 'ready' });
    const c = codes(rec.pick?.reasons ?? []);
    expect(c).toContain('weather');
    expect(c).toContain('daypart');
    expect(rec.pick?.reasons).toContainEqual({ code: 'season', season: 'winter' });
  });

  it('winter night with a hot-drink bar → Hot Toddy', () => {
    const rec = recommend(
      input({
        moment: moment({ month: 1, day: 14, weekday: 3, hour: 23, minute: 30 }),
        weather: { tempC: -2, condition: 'snow' },
        bar: ['bourbon', 'honey', 'lemon'],
        taste: { flavors: ['spicy', 'sweet'] },
        seed: 3,
      }),
      fixtureCatalog,
    );
    expect(rec.pick?.recipeId).toBe('hot-toddy');
    expect(codes(rec.pick?.reasons ?? [])).toEqual(expect.arrayContaining(['weather', 'daypart']));
  });

  it('alcoholFree → pick and every alternative have ABV 0', () => {
    const rec = recommend(
      input({ alcoholFree: true, weather: { tempC: 27, condition: 'clear' }, seed: 11 }),
      fixtureCatalog,
    );
    expect(rec.pick).not.toBeNull();
    for (const s of [rec.pick, ...rec.alternatives]) expect(s?.abv).toBe(0);
    expect(rec.pick?.reasons).toContainEqual({ code: 'alcohol-free' });
  });

  it('Sunday 11:00 brunch occasion → Mimosa, with weekend/occasion reasons', () => {
    const rec = recommend(
      input({
        moment: moment({ month: 9, day: 27, weekday: 0, hour: 11 }),
        occasion: 'brunch',
        seed: 5,
      }),
      fixtureCatalog,
    );
    expect(rec.pick?.recipeId).toBe('mimosa');
    const c = codes(rec.pick?.reasons ?? []);
    expect(c).toEqual(expect.arrayContaining(['occasion', 'weekend', 'daypart']));
  });

  it('bar null → availability unknown everywhere', () => {
    const rec = recommend(input({ bar: null, seed: 2 }), fixtureCatalog);
    for (const s of [rec.pick, ...rec.alternatives])
      expect(s?.availability).toEqual({ status: 'unknown' });
  });

  it('recent drinks are pushed down', () => {
    // Bar unknown: every recipe is a plain candidate, so recency decides.
    const base = input({ weather: { tempC: 27, condition: 'clear' }, seed: 7 });
    const first = recommend(base, fixtureCatalog).pick?.recipeId;
    const second = recommend({ ...base, recent: [first ?? ''] }, fixtureCatalog).pick?.recipeId;
    expect(second).not.toBe(first);
  });

  it('a different seed can reorder near-ties but keeps a strong signal on top', () => {
    const picks = new Set<string | undefined>();
    for (let seed = 0; seed < 20; seed++) {
      picks.add(
        recommend(
          input({ moment: moment({ hour: 11, weekday: 0 }), occasion: 'brunch', seed }),
          fixtureCatalog,
        ).pick?.recipeId,
      );
    }
    expect([...picks]).toEqual(['mimosa']);
  });

  it('empty candidate set → null pick', () => {
    const rec = recommend(input({ bar: [] }), { ...fixtureCatalog, recipes: [] });
    expect(rec).toMatchObject({ pick: null, alternatives: [] });
  });

  it('adds an alcohol-free alternative and at most one discovery (missing) alternative', () => {
    const rec = recommend(
      input({
        weather: { tempC: 27, condition: 'clear' },
        bar: ['gin', 'tonic-water', 'lime', 'campari', 'sweet-vermouth', 'honey', 'water'],
        seed: 1,
      }),
      fixtureCatalog,
    );
    expect(rec.alternatives.some((a) => a.abv === 0)).toBe(true);
    expect(
      rec.alternatives.filter((a) => a.availability.status === 'missing').length,
    ).toBeLessThanOrEqual(1);
  });
});
