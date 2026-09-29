import type { Recipe } from '@sipclock/domain';
import { flavorLabel, glassLabel, type Locale, methodLabel } from '@sipclock/i18n';
import { ingredientLine } from '@/lib/catalog';

export interface RecipeJsonLd {
  '@context': 'https://schema.org';
  '@type': 'Recipe';
  name: string;
  description: string;
  url: string;
  inLanguage: Locale;
  recipeCategory: 'Cocktail';
  recipeIngredient: string[];
  recipeInstructions: { '@type': 'HowToStep'; position: number; text: string }[];
  totalTime: string;
  recipeYield: string;
  keywords: string;
}

/** Minutes to an ISO 8601 duration, e.g. 2 -> "PT2M", 90 -> "PT1H30M". */
export function toIsoDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `PT${m}M`;
  return m === 0 ? `PT${h}H` : `PT${h}H${m}M`;
}

export function recipePath(locale: Locale, id: string): string {
  return `/${locale}/recipes/${id}`;
}

export function buildRecipeJsonLd(recipe: Recipe, locale: Locale, siteUrl: string): RecipeJsonLd {
  const keywords = [
    ...recipe.tags.flavors.map((f) => flavorLabel[locale][f]),
    glassLabel[locale][recipe.glass],
    methodLabel[locale][recipe.method],
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.name[locale],
    description: recipe.description[locale],
    url: `${siteUrl}${recipePath(locale, recipe.id)}`,
    inLanguage: locale,
    recipeCategory: 'Cocktail',
    recipeIngredient: recipe.ingredients.map((i) => ingredientLine(i, locale)),
    recipeInstructions: recipe.steps.map((step, idx) => ({
      '@type': 'HowToStep',
      position: idx + 1,
      text: step[locale],
    })),
    totalTime: toIsoDuration(recipe.timeMinutes),
    recipeYield: locale === 'ru' ? '1 порция' : '1 serving',
    keywords: keywords.join(', '),
  };
}

/** Serializes for inlining in a <script>; `<` is escaped so `</script>` cannot break out. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
