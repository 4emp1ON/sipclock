import { catalog, ingredientsById, recipesById } from '@sipclock/catalog';
import type { Recipe, RecipeIngredient } from '@sipclock/domain';
import { createIndex, estimateAbv, partsBase, type UnitSystem } from '@sipclock/engine';
import type { Locale } from '@sipclock/i18n';
import { formatIngredientAmount } from '@/lib/amounts';

export { catalog, ingredientsById, recipesById };

export const catalogIndex = createIndex(catalog);

export function recipeAbv(recipe: Recipe): number {
  return estimateAbv(recipe, catalogIndex);
}

/** Localized ingredient name; falls back to the id for unknown ingredients. */
export function ingredientName(id: string, locale: Locale): string {
  return ingredientsById.get(id)?.name[locale] ?? id;
}

export function recipeName(id: string, locale: Locale): string {
  return recipesById.get(id)?.name[locale] ?? id;
}

/** "50 ml Gin" for measured items, "Ice (to fill)" / "Lime (1 wedge)" for open-ended ones. */
export function ingredientLine(
  item: RecipeIngredient,
  locale: Locale,
  opts: { unit?: UnitSystem; servings?: number; partsBase?: number | null } = {},
): string {
  const name = ingredientName(item.ingredient, locale);
  const text = formatIngredientAmount(item.amount, locale, opts);
  const open =
    item.amount.unit === 'fill' ||
    item.amount.unit === 'top' ||
    (item.amount.unit === 'piece' && item.amount.noun !== undefined);
  return open ? `${name} (${text})` : `${text} ${name}`;
}

export { partsBase };

/** Recipes sharing a daypart with `recipe`, most overlapping first, stable by id. */
export function relatedRecipes(recipe: Recipe, limit = 4): Recipe[] {
  const mine = new Set(recipe.tags.dayparts);
  return catalog.recipes
    .filter((r) => r.id !== recipe.id)
    .map((r) => ({ r, overlap: r.tags.dayparts.filter((d) => mine.has(d)).length }))
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.r.id.localeCompare(b.r.id))
    .slice(0, limit)
    .map((x) => x.r);
}
