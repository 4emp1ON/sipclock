// Offline / fallback recipe search over the bundled catalog. Loaded on demand (dynamic import) so the static
// recipes page does not ship the whole catalog until someone searches.
import { catalog } from '@sipclock/catalog';
import { createIndex, createRecipeSearcher } from '@sipclock/engine';
import { type RankedHit, SEARCH_LIMIT } from '@/lib/recipe-search';

const searcher = createRecipeSearcher(createIndex(catalog));

export function localSearch(query: string): RankedHit[] {
  return searcher
    .search(query, { limit: SEARCH_LIMIT })
    .map((h) => ({ id: h.recipeId, field: h.field }));
}
