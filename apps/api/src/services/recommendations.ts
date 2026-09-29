import type {
  Catalog,
  Glass,
  Localized,
  Method,
  Recommendation,
  RecommendInput,
} from '@sipclock/domain';
import { recommend } from '@sipclock/engine';
import type { CatalogService } from './catalog.ts';

export interface RecipeSummary {
  id: string;
  name: Localized;
  glass: Glass;
  method: Method;
}

export interface RecommendationResult extends Recommendation {
  /** Minimal data for pick and alternatives so thin clients can render without the bundle. */
  recipes: RecipeSummary[];
}

export interface UnknownId {
  field: string;
  id: string;
}

export interface RecommendationService {
  /** Ids in `bar` / `recent` that the catalog does not know, with their input paths. */
  findUnknownIds(input: Pick<RecommendInput, 'bar' | 'recent'>): UnknownId[];
  recommend(input: RecommendInput): RecommendationResult;
}

export function createRecommendationService(catalogService: CatalogService): RecommendationService {
  const { catalog } = catalogService;
  const ingredientIds = new Set(catalog.ingredients.map((i) => i.id));
  const recipesById = new Map(catalog.recipes.map((r) => [r.id, r]));

  return {
    findUnknownIds({ bar, recent }) {
      const unknown: UnknownId[] = [];
      bar?.forEach((id, i) => {
        if (!ingredientIds.has(id)) unknown.push({ field: `bar.${i}`, id });
      });
      recent?.forEach((id, i) => {
        if (!recipesById.has(id)) unknown.push({ field: `recent.${i}`, id });
      });
      return unknown;
    },
    recommend(input) {
      const result = recommend(input, catalog as Catalog);
      const ids = [result.pick, ...result.alternatives].flatMap((s) => (s ? [s.recipeId] : []));
      const recipes: RecipeSummary[] = [];
      for (const id of ids) {
        const r = recipesById.get(id);
        if (r) recipes.push({ id: r.id, name: r.name, glass: r.glass, method: r.method });
      }
      return { ...result, recipes };
    },
  };
}
