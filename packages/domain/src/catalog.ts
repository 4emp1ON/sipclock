import { z } from 'zod';

// The catalog stores generic ingredient categories ("white rum"), never brands — see docs/adr/0002.

export const localized = z.object({ en: z.string().min(1), ru: z.string().min(1) });
export type Localized = z.infer<typeof localized>;

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case id');

export const ingredientKind = z.enum([
  'spirit',
  'liqueur',
  'wine',
  'beer',
  'bitters',
  'syrup',
  'juice',
  'mixer',
  'fresh',
  'dairy',
  'pantry',
  'staple',
]);
export type IngredientKind = z.infer<typeof ingredientKind>;

export const ingredient = z.object({
  id: slug,
  name: localized,
  kind: ingredientKind,
  /** More generic ingredient this one specializes: `london-dry-gin` → `gin`. Either satisfies the other in the bar. */
  parent: slug.optional(),
  /** Alcohol by volume, percent. */
  abv: z.number().min(0).max(100),
  /** Acceptable replacements when this ingredient is missing, best first. */
  substitutes: z
    .array(
      z.object({
        id: slug,
        note: localized.optional(),
        /**
         * Changes the drink's character: offered by "Find a swap", but a drink that needs it is not
         * counted as makeable (tonic for soda water is fine, soda water in a Gin & Tonic is not).
         */
        loose: z.literal(true).optional(),
      }),
    )
    .default([]),
  /**
   * Can be prepared at home from this ingredient: `lemon-juice` ← `lemon`, `simple-syrup` ← `sugar`.
   * Having the source in the bar covers the need (it is not a substitution).
   */
  madeFrom: slug.optional(),
  /** Staples (ice, water) are assumed to be in every bar. */
  staple: z.boolean().default(false),
});
export type Ingredient = z.infer<typeof ingredient>;

export const amount = z.discriminatedUnion('unit', [
  z.object({ unit: z.literal('ml'), value: z.number().positive() }),
  z.object({ unit: z.literal('dash'), value: z.number().positive() }),
  z.object({ unit: z.literal('barspoon'), value: z.number().positive() }),
  z.object({ unit: z.literal('piece'), value: z.number().positive(), noun: localized.optional() }),
  /** "Top up with": volume is an estimate used for ABV and scaling. */
  z.object({ unit: z.literal('top'), estimateMl: z.number().positive() }),
  z.object({ unit: z.literal('fill') }),
]);
export type Amount = z.infer<typeof amount>;

export const recipeIngredient = z.object({
  ingredient: slug,
  amount,
  optional: z.boolean().default(false),
  garnish: z.boolean().default(false),
});
export type RecipeIngredient = z.infer<typeof recipeIngredient>;

export const occasion = z.enum(['after-work', 'date', 'party', 'chill', 'brunch']);
export type Occasion = z.infer<typeof occasion>;

export const flavor = z.enum([
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
]);
export type Flavor = z.infer<typeof flavor>;

/** Parts of the day a drink suits. Hour windows live in the engine rules, not in the data. */
export const daypart = z.enum(['brunch', 'aperitif', 'evening', 'late']);
export type Daypart = z.infer<typeof daypart>;

export const weatherFit = z.enum(['hot', 'mild', 'cold', 'rainy']);
export type WeatherFit = z.infer<typeof weatherFit>;

export const glass = z.enum([
  'highball',
  'collins',
  'rocks',
  'coupe',
  'martini',
  'flute',
  'wine',
  'copper-mug',
  'hurricane',
  'irish-coffee',
  'shot',
]);
export type Glass = z.infer<typeof glass>;

export const method = z.enum(['build', 'stir', 'shake', 'blend', 'muddle', 'layer', 'heat']);
export type Method = z.infer<typeof method>;

export const recipe = z.object({
  id: slug,
  name: localized,
  description: localized,
  glass,
  method,
  ingredients: z.array(recipeIngredient).min(1),
  steps: z.array(localized).min(1),
  tags: z.object({
    occasions: z.array(occasion).min(1),
    flavors: z.array(flavor).min(1),
    dayparts: z.array(daypart).min(1),
    weather: z.array(weatherFit).min(1),
  }),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  timeMinutes: z.number().int().positive(),
  /** Alcohol-free counterpart, if the catalog has one. */
  zeroProofTwin: slug.optional(),
  /** Listed by the International Bartenders Association. */
  iba: z.boolean().default(false),
});
export type Recipe = z.infer<typeof recipe>;

export const catalog = z.object({
  version: z.string().regex(/^\d{4}\.\d{2}\.\d{2}(\.\d+)?$/, 'calendar version, e.g. 2026.09.29'),
  ingredients: z.array(ingredient),
  recipes: z.array(recipe),
});
export type Catalog = z.infer<typeof catalog>;
export type CatalogInput = z.input<typeof catalog>;
