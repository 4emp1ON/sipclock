import type { Availability, Recipe, RecipeIngredient } from '@sipclock/domain';
import { ancestorsOf, type CatalogIndex, descendantsOf, isStaple } from './graph.ts';

export type BarInput = readonly string[] | ReadonlySet<string>;

function toSet(bar: BarInput): ReadonlySet<string> {
  return bar instanceof Set ? bar : new Set(bar);
}

/** Is `need` covered by the bar (directly, via hierarchy, as a staple, or made from what is there)? */
export function barHas(
  bar: ReadonlySet<string>,
  need: string,
  index: CatalogIndex,
  seen: ReadonlySet<string> = new Set(),
): boolean {
  if (isStaple(index, need) || bar.has(need)) return true;
  if (
    ancestorsOf(index, need).some((id) => bar.has(id)) ||
    descendantsOf(index, need).some((id) => bar.has(id))
  ) {
    return true;
  }
  const source = index.ingredients.get(need)?.madeFrom;
  return (
    source !== undefined &&
    !seen.has(source) &&
    barHas(bar, source, index, new Set([...seen, need]))
  );
}

/** Ingredients that decide availability: everything that is neither optional nor garnish. */
export function requiredIngredients(recipe: Recipe): RecipeIngredient[] {
  return recipe.ingredients.filter((i) => !i.optional && !i.garnish);
}

export interface AvailabilityDetail {
  /** Required, non-staple ingredients covered directly (no swap). */
  present: string[];
  swaps: { need: string; use: string }[];
  missing: string[];
}

export function analyzeAvailability(
  recipe: Recipe,
  bar: BarInput,
  index: CatalogIndex,
): AvailabilityDetail {
  const set = toSet(bar);
  const detail: AvailabilityDetail = { present: [], swaps: [], missing: [] };
  for (const { ingredient } of requiredIngredients(recipe)) {
    if (barHas(set, ingredient, index)) {
      if (!isStaple(index, ingredient)) detail.present.push(ingredient);
      continue;
    }
    const subs = index.ingredients.get(ingredient)?.substitutes ?? [];
    // Loose swaps change the drink too much to call it makeable; "Find a swap" still offers them.
    const use = subs.find((s) => !s.loose && barHas(set, s.id, index));
    if (use) detail.swaps.push({ need: ingredient, use: use.id });
    else detail.missing.push(ingredient);
  }
  return detail;
}

/** Availability of a recipe for a bar; `null` bar means unknown. */
export function availability(
  recipe: Recipe,
  bar: BarInput | null,
  index: CatalogIndex,
): Availability {
  if (bar === null) return { status: 'unknown' };
  const { swaps, missing } = analyzeAvailability(recipe, bar, index);
  if (missing.length > 0) return { status: 'missing', missing, swaps };
  if (swaps.length > 0) return { status: 'swap', swaps };
  return { status: 'ready' };
}

/** Lower is better. `unknown` ranks with `ready` (nothing known to be wrong). */
export function availabilityRank(a: Availability): number {
  switch (a.status) {
    case 'ready':
    case 'unknown':
      return 0;
    case 'swap':
      return 1;
    case 'missing':
      return 2;
  }
}

export function missingCount(a: Availability): number {
  return a.status === 'missing' ? a.missing.length : 0;
}
