import type { Recipe } from '@/data/recipes';

export interface RecipeJsonLd {
  '@context': 'https://schema.org';
  '@type': 'Recipe';
  name: string;
  description: string;
  url: string;
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

export function buildRecipeJsonLd(recipe: Recipe, siteUrl: string): RecipeJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.name,
    description: recipe.description,
    url: `${siteUrl}/recipes/${recipe.slug}`,
    recipeCategory: 'Cocktail',
    recipeIngredient: recipe.ingredients.map((i) => `${i.amount} ${i.name}`),
    recipeInstructions: recipe.steps.map((text, idx) => ({
      '@type': 'HowToStep',
      position: idx + 1,
      text,
    })),
    totalTime: toIsoDuration(recipe.minutes),
    recipeYield: recipe.yield,
    keywords: recipe.keywords.join(', '),
  };
}

/** Serializes for inlining in a <script>; `<` is escaped so `</script>` cannot break out. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
