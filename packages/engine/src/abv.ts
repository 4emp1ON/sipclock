import type { Amount, Method, Recipe } from '@sipclock/domain';
import type { CatalogIndex } from './graph.ts';

/**
 * Dilution by method: fraction of the mixed volume added by melted ice.
 * Tuned so Negroni ≈ 23%, Old Fashioned ≈ 30%, Daiquiri ≈ 19%, G&T ≈ 9%.
 */
export const DILUTION: Readonly<Record<Method, number>> = {
  build: 0.1,
  stir: 0.2,
  shake: 0.25,
  blend: 0.35,
  muddle: 0.15,
  layer: 0,
  heat: 0,
};

export const DASH_ML = 0.9;
export const BARSPOON_ML = 5;
/** Ingredients at or below this ABV count as alcohol-free (kombucha-style traces, juices). */
export const ZERO_ABV_THRESHOLD = 0.5;

/** Liquid volume of an amount. Pieces and `fill` (ice) count as 0. */
export function amountMl(amount: Amount): number {
  switch (amount.unit) {
    case 'ml':
      return amount.value;
    case 'dash':
      return amount.value * DASH_ML;
    case 'barspoon':
      return amount.value * BARSPOON_ML;
    case 'top':
      return amount.estimateMl;
    case 'piece':
    case 'fill':
      return 0;
  }
}

/**
 * Estimated ABV (integer percent) of the finished drink: pure alcohol / (liquid × (1 + dilution)).
 * Optional and garnish ingredients are ignored. Heated drinks are not reduced for evaporation.
 */
export function estimateAbv(recipe: Recipe, index: CatalogIndex): number {
  let liquid = 0;
  let alcohol = 0;
  for (const item of recipe.ingredients) {
    if (item.optional || item.garnish) continue;
    const ml = amountMl(item.amount);
    if (ml <= 0) continue;
    const abv = index.ingredients.get(item.ingredient)?.abv ?? 0;
    liquid += ml;
    if (abv > ZERO_ABV_THRESHOLD) alcohol += (ml * abv) / 100;
  }
  if (alcohol === 0) return isAlcoholFree(recipe, index) ? 0 : 1;
  if (liquid === 0) return 0;
  // 0% is reserved for drinks with no alcoholic ingredient at all: a few dashes of bitters still make
  // a drink unsuitable for someone who avoids alcohol, so it never rounds down to 0.
  return Math.max(1, Math.round((alcohol / (liquid * (1 + DILUTION[recipe.method]))) * 100));
}

/**
 * True only if no line of the recipe, optional and garnish included, is alcoholic.
 * This is the definition behind "alcohol-free" everywhere: `estimateAbv` returns 0 exactly for these.
 */
export function isAlcoholFree(recipe: Recipe, index: CatalogIndex): boolean {
  return recipe.ingredients.every(
    (item) => (index.ingredients.get(item.ingredient)?.abv ?? 0) <= ZERO_ABV_THRESHOLD,
  );
}
