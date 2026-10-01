import { type Catalog, catalog as catalogSchema } from '@sipclock/domain';
import { ingredients } from './data/ingredients.ts';
import { recipes } from './data/recipes/index.ts';

export const CATALOG_VERSION = '2026.10.01.1';

export const catalog: Catalog = catalogSchema.parse({
  version: CATALOG_VERSION,
  ingredients,
  recipes,
});

export const ingredientsById: ReadonlyMap<string, Catalog['ingredients'][number]> = new Map(
  catalog.ingredients.map((i) => [i.id, i]),
);
export const recipesById: ReadonlyMap<string, Catalog['recipes'][number]> = new Map(
  catalog.recipes.map((r) => [r.id, r]),
);
