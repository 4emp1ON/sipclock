import type { Amount, RecommendInput } from '@sipclock/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fixtureCatalog } from './__fixtures__/catalog.ts';
import { availability, availabilityRank, missingCount } from './availability.ts';
import { createIndex } from './graph.ts';
import { recommend } from './recommend.ts';
import { defaultRules } from './rules.ts';
import { ML_PER_OZ, scaleAmount, toDisplay } from './units.ts';

const index = createIndex(fixtureCatalog);
const ingredientIds = fixtureCatalog.ingredients.map((i) => i.id);
const recipeIds = fixtureCatalog.recipes.map((r) => r.id);

const momentArb = fc.record({
  year: fc.constant(2026),
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 28 }),
  weekday: fc.integer({ min: 0, max: 6 }),
  hour: fc.integer({ min: 0, max: 23 }),
  minute: fc.integer({ min: 0, max: 59 }),
  hemisphere: fc.constantFrom('north' as const, 'south' as const),
});
const weatherArb = fc.option(
  fc.record({
    tempC: fc.integer({ min: -25, max: 45 }),
    condition: fc.constantFrom(
      'clear' as const,
      'cloudy' as const,
      'rain' as const,
      'snow' as const,
    ),
  }),
  { nil: null },
);
const barArb = fc.option(fc.subarray(ingredientIds), { nil: null });
const inputArb: fc.Arbitrary<RecommendInput> = fc.record(
  {
    moment: momentArb,
    occasion: fc.constantFrom(
      'after-work' as const,
      'date' as const,
      'party' as const,
      'chill' as const,
      'brunch' as const,
    ),
    weather: weatherArb,
    bar: barArb,
    taste: fc.record(
      {
        flavors: fc.subarray([
          'sour',
          'sweet',
          'bitter',
          'fresh',
          'fruity',
          'herbal',
          'spicy',
          'creamy',
          'smoky',
          'boozy',
        ] as const),
        strength: fc.constantFrom(
          'zero' as const,
          'light' as const,
          'medium' as const,
          'strong' as const,
        ),
      },
      { requiredKeys: ['flavors'] },
    ),
    alcoholFree: fc.boolean(),
    recent: fc.subarray(recipeIds),
    seed: fc.integer({ min: -1_000_000, max: 1_000_000 }),
    alternatives: fc.integer({ min: 0, max: 6 }),
  },
  { requiredKeys: ['moment', 'weather', 'bar', 'seed'] },
);

describe('recommend: properties', () => {
  it('is deterministic (deep equal)', () => {
    fc.assert(
      fc.property(inputArb, (i) => {
        expect(recommend(i, fixtureCatalog)).toEqual(recommend(structuredClone(i), fixtureCatalog));
      }),
    );
  });

  it('pick is not among alternatives and alternatives are unique', () => {
    fc.assert(
      fc.property(inputArb, (i) => {
        const rec = recommend(i, fixtureCatalog);
        const ids = rec.alternatives.map((a) => a.recipeId);
        expect(new Set(ids).size).toBe(ids.length);
        if (rec.pick) expect(ids).not.toContain(rec.pick.recipeId);
        expect(ids.length).toBeLessThanOrEqual(i.alternatives ?? 3);
        if (!rec.pick) expect(ids).toEqual([]);
      }),
    );
  });

  it('alcoholFree ⇒ every result has ABV 0', () => {
    fc.assert(
      fc.property(inputArb, (i) => {
        const rec = recommend({ ...i, alcoholFree: true }, fixtureCatalog);
        for (const s of [rec.pick, ...rec.alternatives]) if (s) expect(s.abv).toBe(0);
      }),
    );
  });

  it('known bar ⇒ no result exceeds maxMissing; unknown bar ⇒ all unknown', () => {
    fc.assert(
      fc.property(inputArb, (i) => {
        const rec = recommend(i, fixtureCatalog);
        for (const s of [rec.pick, ...rec.alternatives]) {
          if (!s) continue;
          if (i.bar === null) expect(s.availability.status).toBe('unknown');
          else expect(missingCount(s.availability)).toBeLessThanOrEqual(defaultRules.maxMissing);
        }
      }),
    );
  });

  it('at most one missing alternative; pick is not missing when a ready/swap candidate exists', () => {
    fc.assert(
      fc.property(inputArb, (i) => {
        const rec = recommend({ ...i, alternatives: 20 }, fixtureCatalog);
        const all = [rec.pick, ...rec.alternatives].filter((s) => s !== null);
        const nonMissing = all.some((s) => s.availability.status !== 'missing');
        if (rec.pick?.availability.status === 'missing') expect(nonMissing).toBe(false);
        else {
          expect(
            rec.alternatives.filter((s) => s.availability.status === 'missing').length,
          ).toBeLessThanOrEqual(1);
        }
      }),
    );
  });

  it('alternatives scores are non-increasing, except a trailing alcohol-free item added by the diversity rule', () => {
    fc.assert(
      fc.property(inputArb, (i) => {
        const { alternatives } = recommend(i, fixtureCatalog);
        // The diversity rule can only place an item in the LAST slot, and only a zero-proof one.
        const last = alternatives[alternatives.length - 1];
        const ordered =
          last?.abv === 0 && !i.alcoholFree ? alternatives.slice(0, -1) : alternatives;
        for (let k = 1; k < ordered.length; k++) {
          expect(ordered[k]?.score ?? 0).toBeLessThanOrEqual(ordered[k - 1]?.score ?? 0);
        }
      }),
    );
  });

  it('when not alcohol-free and a zero-proof candidate exists, an alcohol-free alternative is offered', () => {
    fc.assert(
      fc.property(inputArb, fc.integer({ min: 1, max: 5 }), (i, n) => {
        const base = { ...i, alcoholFree: false, alternatives: n };
        const everything = recommend({ ...base, alternatives: 50 }, fixtureCatalog);
        const zeroExists = everything.alternatives.some((a) => a.abv === 0);
        const rec = recommend(base, fixtureCatalog);
        if (zeroExists) expect(rec.alternatives.some((a) => a.abv === 0)).toBe(true);
      }),
    );
  });

  it('adding an ingredient to the bar never makes availability worse', () => {
    fc.assert(
      fc.property(fc.subarray(ingredientIds), fc.constantFrom(...ingredientIds), (bar, extra) => {
        for (const recipe of fixtureCatalog.recipes) {
          const before = availability(recipe, bar, index);
          const after = availability(recipe, [...bar, extra], index);
          expect(availabilityRank(after)).toBeLessThanOrEqual(availabilityRank(before));
          expect(missingCount(after)).toBeLessThanOrEqual(missingCount(before));
        }
      }),
    );
  });
});

describe('units: properties', () => {
  const amountArb = fc.oneof(
    fc.record({
      unit: fc.constant('ml' as const),
      value: fc.double({ min: 0.5, max: 500, noNaN: true }),
    }),
    fc.record({ unit: fc.constant('dash' as const), value: fc.integer({ min: 1, max: 10 }) }),
    fc.record({ unit: fc.constant('barspoon' as const), value: fc.integer({ min: 1, max: 4 }) }),
    fc.record({
      unit: fc.constant('top' as const),
      estimateMl: fc.double({ min: 10, max: 300, noNaN: true }),
    }),
    fc.constant({ unit: 'fill' as const }),
  );
  const servingsArb = fc.double({ min: 0.25, max: 40, noNaN: true });

  it('scaling is linear and composes', () => {
    fc.assert(
      fc.property(amountArb, servingsArb, servingsArb, (a, s, t) => {
        const once = scaleAmount(a, s);
        const twice = scaleAmount(once, t);
        const direct = scaleAmount(a, s * t);
        if (a.unit === 'fill') {
          expect(once).toEqual(a);
          return;
        }
        const val = (x: Amount) => (x.unit === 'top' ? x.estimateMl : 'value' in x ? x.value : 0);
        expect(val(once)).toBeCloseTo(val(a) * s, 6);
        expect(val(twice)).toBeCloseTo(val(direct), 6);
        expect(twice.unit).toBe(a.unit);
      }),
    );
  });

  it('oz conversion error is at most 1/8 oz', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.5, max: 900, noNaN: true }), (value) => {
        const out = toDisplay({ unit: 'ml', value }, 'oz');
        if (out.unit === 'oz') {
          expect(Math.abs(out.value - value / ML_PER_OZ)).toBeLessThanOrEqual(0.125 + 1e-9);
          expect(out.value * 4).toBe(Math.round(out.value * 4));
        } else expect(out).toEqual({ unit: 'ml', value }); // only when it would round to 0
      }),
    );
  });

  it('parts are multiples of 0.5 and at least 0.5', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 5, max: 200, noNaN: true }),
        fc.double({ min: 5, max: 60, noNaN: true }),
        (value, base) => {
          const out = toDisplay({ unit: 'ml', value }, 'parts', { partsBase: base });
          expect(out.unit).toBe('parts');
          if (out.unit === 'parts') {
            expect(out.value).toBeGreaterThanOrEqual(0.5);
            expect(out.value * 2).toBe(Math.round(out.value * 2));
          }
        },
      ),
    );
  });
});
