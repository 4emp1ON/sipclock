import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { catalog as catalogSchema, daypart, occasion, weatherFit } from '@sipclock/domain';
import { describe, expect, it } from 'vitest';
import { render } from './build.ts';
import { catalog, ingredientsById, recipesById } from './index.ts';

const CYRILLIC = /[Ѐ-ӿ]/;
const isAlcoholFree = (r: (typeof catalog.recipes)[number]) =>
  r.ingredients.every((line) => (ingredientsById.get(line.ingredient)?.abv ?? 0) <= 0.5);

describe('schema and identity', () => {
  it('is schema-valid', () => {
    expect(catalogSchema.safeParse(catalog).success).toBe(true);
  });

  it('has unique ingredient and recipe ids', () => {
    expect(new Set(catalog.ingredients.map((i) => i.id)).size).toBe(catalog.ingredients.length);
    expect(new Set(catalog.recipes.map((r) => r.id)).size).toBe(catalog.recipes.length);
  });

  it('has the expected size', () => {
    expect(catalog.ingredients.length).toBeGreaterThanOrEqual(60);
    expect(catalog.recipes.length).toBeGreaterThanOrEqual(40);
  });
});

describe('references', () => {
  it('resolves every ingredient reference', () => {
    for (const r of catalog.recipes) {
      for (const line of r.ingredients) {
        expect(ingredientsById.has(line.ingredient), `${r.id} -> ${line.ingredient}`).toBe(true);
      }
    }
    for (const i of catalog.ingredients) {
      if (i.parent) expect(ingredientsById.has(i.parent), `${i.id} parent`).toBe(true);
      if (i.madeFrom) expect(ingredientsById.has(i.madeFrom), `${i.id} madeFrom`).toBe(true);
      for (const s of i.substitutes) {
        expect(ingredientsById.has(s.id), `${i.id} substitute ${s.id}`).toBe(true);
        expect(s.id, `${i.id} substitutes itself`).not.toBe(i.id);
      }
    }
  });

  it('has no parent cycles and compatible kinds along parent chains', () => {
    for (const i of catalog.ingredients) {
      const seen = new Set([i.id]);
      let cur = i;
      while (cur.parent) {
        const parent = ingredientsById.get(cur.parent);
        expect(parent, `${cur.id} parent`).toBeDefined();
        if (!parent) break;
        expect(seen.has(parent.id), `cycle at ${i.id}`).toBe(false);
        expect(parent.kind, `${cur.id} -> ${parent.id} kind`).toBe(cur.kind);
        seen.add(parent.id);
        cur = parent;
      }
    }
  });

  it('substitutes outside the ingredient family, alcohol-free for alcohol-free ingredients', () => {
    const lineage = (id: string) => {
      const out: string[] = [];
      for (let cur = ingredientsById.get(id)?.parent; cur; cur = ingredientsById.get(cur)?.parent) {
        out.push(cur);
      }
      return out;
    };
    for (const i of catalog.ingredients) {
      for (const s of i.substitutes) {
        // A relative already satisfies the need, so the service would drop it as a candidate.
        expect(lineage(i.id), `${i.id} substitute ${s.id} is an ancestor`).not.toContain(s.id);
        expect(lineage(s.id), `${i.id} substitute ${s.id} is a descendant`).not.toContain(i.id);
        // Zero-proof drinks must stay zero-proof after a swap.
        if (i.abv <= 0.5) {
          expect(
            ingredientsById.get(s.id)?.abv ?? 0,
            `${i.id} substitute ${s.id}`,
          ).toBeLessThanOrEqual(0.5);
        }
      }
    }
  });

  it('has valid zeroProofTwin targets', () => {
    for (const r of catalog.recipes) {
      if (!r.zeroProofTwin) continue;
      const twin = recipesById.get(r.zeroProofTwin);
      expect(twin, `${r.id} twin`).toBeDefined();
      if (twin)
        expect(isAlcoholFree(twin), `${r.id} twin ${twin.id} must be alcohol-free`).toBe(true);
    }
  });
});

describe('recipes', () => {
  it('has at least one required, non-garnish ingredient each', () => {
    for (const r of catalog.recipes) {
      expect(
        r.ingredients.some((l) => !l.optional && !l.garnish),
        r.id,
      ).toBe(true);
    }
  });

  it('lists each ingredient once per recipe', () => {
    for (const r of catalog.recipes) {
      const ids = r.ingredients.map((l) => l.ingredient);
      expect(new Set(ids).size, r.id).toBe(ids.length);
    }
  });

  it('marks garnishes as garnish', () => {
    for (const r of catalog.recipes) {
      const nonGarnish = r.ingredients.filter((l) => !l.garnish);
      expect(nonGarnish.length, r.id).toBeGreaterThan(0);
    }
  });

  it('has 12 or more alcohol-free recipes', () => {
    const free = catalog.recipes.filter(isAlcoholFree);
    expect(free.length).toBeGreaterThanOrEqual(12);
  });

  it('keeps alcoholic recipes actually alcoholic', () => {
    for (const r of catalog.recipes.filter((x) => !isAlcoholFree(x))) {
      expect(
        r.ingredients.some(
          (l) => (ingredientsById.get(l.ingredient)?.abv ?? 0) > 0.5 && !l.optional,
        ),
        r.id,
      ).toBe(true);
    }
  });

  it('has 3-6 steps', () => {
    for (const r of catalog.recipes) {
      expect(r.steps.length, r.id).toBeGreaterThanOrEqual(3);
      expect(r.steps.length, r.id).toBeLessThanOrEqual(6);
    }
  });

  it.each([
    ['occasion', occasion.options, (r: (typeof catalog.recipes)[number]) => r.tags.occasions],
    ['daypart', daypart.options, (r: (typeof catalog.recipes)[number]) => r.tags.dayparts],
    ['weather', weatherFit.options, (r: (typeof catalog.recipes)[number]) => r.tags.weather],
  ] as const)('covers every %s with 3+ recipes', (_name, options, pick) => {
    for (const value of options) {
      const count = catalog.recipes.filter((r) =>
        (pick(r) as readonly string[]).includes(value),
      ).length;
      expect(count, String(value)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('localization', () => {
  const differs = (t: { en: string; ru: string }) => t.en !== t.ru && CYRILLIC.test(t.ru);

  it('translates ingredient names', () => {
    for (const i of catalog.ingredients) expect(CYRILLIC.test(i.name.ru), i.id).toBe(true);
  });

  it('translates recipe texts', () => {
    for (const r of catalog.recipes) {
      expect(differs(r.description), `${r.id} description`).toBe(true);
      r.steps.forEach((s, n) => {
        expect(differs(s), `${r.id} step ${n + 1}`).toBe(true);
      });
      expect(CYRILLIC.test(r.name.ru), `${r.id} name`).toBe(true);
    }
  });
});

describe('brand blocklist', () => {
  const BRANDS =
    /campari|aperol|angostura|cointreau|kahl[uú]a|baileys|bacardi|smirnoff|j[aä]germeister|gosling|tabasco|lea\s*&\s*perrins|martini\s*&\s*rossi|chambord|st[.-]?\s?germain|luxardo|bombay|hendrick|tanqueray|jack daniel|havana club|absolut|кампари|апероль|ангостур|куантро|калуа|бейлис|бакарди|смирнофф|егермейстер|табаско|шамбор|абсолют/i;

  it('has no brand names in ingredient names', () => {
    for (const i of catalog.ingredients) {
      expect(`${i.name.en} ${i.name.ru}`, i.id).not.toMatch(BRANDS);
      for (const s of i.substitutes) {
        expect(`${s.note?.en ?? ''} ${s.note?.ru ?? ''}`, i.id).not.toMatch(BRANDS);
      }
    }
  });

  it('has no brand names in recipe texts', () => {
    for (const r of catalog.recipes) {
      const text = [r.description, ...r.steps].map((t) => `${t.en} ${t.ru}`).join(' ');
      expect(text, r.id).not.toMatch(BRANDS);
    }
  });
});

describe('generated bundle', () => {
  const dir = join(import.meta.dirname, '..', 'generated');
  const { catalogJson, manifestJson } = render();

  it('catalog.json is up to date', () => {
    expect(readFileSync(join(dir, 'catalog.json'), 'utf8')).toBe(catalogJson);
  });

  it('manifest.json is up to date', () => {
    expect(readFileSync(join(dir, 'manifest.json'), 'utf8')).toBe(manifestJson);
  });
});
