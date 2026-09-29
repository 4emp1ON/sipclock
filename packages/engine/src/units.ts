import type { Amount, Recipe } from '@sipclock/domain';

export type UnitSystem = 'ml' | 'oz' | 'parts';

export type DisplayAmount =
  | Amount
  | { unit: 'oz'; value: number }
  | { unit: 'parts'; value: number };

export interface DisplayContext {
  /** Smallest ml amount of the recipe ({@link partsBase}); required for `parts`. */
  partsBase: number | null;
}

export const ML_PER_OZ = 29.5735;

/** Scale for a number of servings. `fill` is unchanged; everything else is linear. */
export function scaleAmount(amount: Amount, servings: number): Amount {
  switch (amount.unit) {
    case 'fill':
      return amount;
    case 'top':
      return { unit: 'top', estimateMl: amount.estimateMl * servings };
    case 'piece':
      return { ...amount, value: amount.value * servings };
    case 'ml':
    case 'dash':
    case 'barspoon':
      return { unit: amount.unit, value: amount.value * servings };
  }
}

/** Smallest ml amount among non-garnish ml ingredients; `null` if there is none. */
export function partsBase(recipe: Recipe): number | null {
  let base: number | null = null;
  for (const item of recipe.ingredients) {
    if (item.garnish || item.optional || item.amount.unit !== 'ml') continue;
    if (base === null || item.amount.value < base) base = item.amount.value;
  }
  return base;
}

/**
 * Convert for display. Only `ml` amounts change:
 * - oz: nearest 1/4 oz; amounts under ~3.7 ml would round to 0, so they stay in ml.
 * - parts: relative to `ctx.partsBase`, nearest 0.5; stays ml when there is no base.
 * Everything else passes through. Formatting and localization are left to the apps.
 */
export function toDisplay(
  amount: Amount,
  system: UnitSystem,
  ctx: DisplayContext = { partsBase: null },
): DisplayAmount {
  if (amount.unit !== 'ml' || system === 'ml') return amount;
  if (system === 'oz') {
    const value = Math.round((amount.value / ML_PER_OZ) * 4) / 4;
    return value === 0 ? amount : { unit: 'oz', value };
  }
  if (ctx.partsBase === null || ctx.partsBase <= 0) return amount;
  return {
    unit: 'parts',
    value: Math.max(0.5, Math.round((amount.value / ctx.partsBase) * 2) / 2),
  };
}
