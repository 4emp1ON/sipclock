import type { Amount } from '@sipclock/domain';
import { scaleAmount, toDisplay, type UnitSystem } from '@sipclock/engine';
import { formatAmount, type Locale } from '@sipclock/i18n';

/** Amount text for one recipe line, honoring the unit system and servings. */
export function formatIngredientAmount(
  amount: Amount,
  locale: Locale,
  opts: { unit?: UnitSystem; servings?: number; partsBase?: number | null } = {},
): string {
  const { unit = 'ml', servings = 1, partsBase: base = null } = opts;
  const scaled = scaleAmount(amount, servings);
  // A partsBase scaled with the servings keeps ratios stable ("2 parts" stays "2 parts").
  const ctxBase = base === null ? null : base * servings;
  return formatAmount(toDisplay(scaled, unit, { partsBase: ctxBase }), locale);
}
