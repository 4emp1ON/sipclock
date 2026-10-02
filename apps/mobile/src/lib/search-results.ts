import { recipesById } from '@sipclock/catalog';
import type { Recipe } from '@sipclock/domain';
import {
  availability,
  availabilityRank,
  type BarInput,
  type CatalogIndex,
  estimateAbv,
  type SearchHit,
} from '@sipclock/engine';

import type { ApiSearchField, ApiSearchHit } from './search-api';

export interface SearchFilters {
  canMake: boolean;
  alcoholFree: boolean;
  under15: boolean;
  highball: boolean;
}

export const NO_FILTERS: SearchFilters = {
  canMake: false,
  alcoholFree: false,
  under15: false,
  highball: false,
};

export const MIN_QUERY_CHARS = 2;
export const BROWSE_LIMIT = 50;
export const SUGGESTION_LIMIT = 8;

export interface ResultHit {
  id: string;
  field: ApiSearchField;
}

export const anyFilter = (f: SearchFilters): boolean =>
  f.canMake || f.alcoholFree || f.under15 || f.highball;

/** Ready or swap-only counts as makeable; with an unknown bar (still loading) nothing is excluded. */
export function canMakeNow(recipe: Recipe, bar: BarInput | null, index: CatalogIndex): boolean {
  const { status } = availability(recipe, bar, index);
  return status === 'ready' || status === 'swap' || status === 'unknown';
}

export function matchesFilters(
  recipe: Recipe,
  filters: SearchFilters,
  bar: BarInput | null,
  index: CatalogIndex,
): boolean {
  if (filters.highball && recipe.glass !== 'highball') return false;
  if (filters.canMake && !canMakeNow(recipe, bar, index)) return false;
  if (filters.alcoholFree || filters.under15) {
    const abv = estimateAbv(recipe, index);
    if (filters.alcoholFree && abv !== 0) return false;
    if (filters.under15 && abv >= 15) return false;
  }
  return true;
}

/** The API order replaces the local one when it has answers; otherwise (no answer, no hits) local stays. */
export function mergeHits(
  local: readonly SearchHit[],
  api: readonly ApiSearchHit[] | null,
): ResultHit[] {
  if (api?.some((h) => recipesById.has(h.id))) {
    return api.filter((h) => recipesById.has(h.id)).map((h) => ({ id: h.id, field: h.field }));
  }
  return local.map((h) => ({ id: h.recipeId, field: h.field }));
}

/** Keeps order; drops unknown ids and recipes the filters exclude. */
export function filterHits(
  hits: readonly ResultHit[],
  filters: SearchFilters,
  bar: BarInput | null,
  index: CatalogIndex,
): ResultHit[] {
  return hits.filter((h) => {
    const recipe = recipesById.get(h.id);
    return recipe !== undefined && matchesFilters(recipe, filters, bar, index);
  });
}

/**
 * Empty-query list: the catalog with the filters applied, drinks you can make first (stable otherwise),
 * capped. With no filters this is the short "ideas" list.
 */
export function browseRecipes(
  recipes: readonly Recipe[],
  filters: SearchFilters,
  bar: BarInput | null,
  index: CatalogIndex,
  limit: number,
): Recipe[] {
  return recipes
    .filter((r) => matchesFilters(r, filters, bar, index))
    .map((recipe, i) => ({ recipe, i, rank: availabilityRank(availability(recipe, bar, index)) }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.recipe);
}
