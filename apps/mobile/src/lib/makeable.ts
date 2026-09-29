import { catalog as defaultCatalog } from '@sipclock/catalog';
import type { Catalog } from '@sipclock/domain';
import { availability, type CatalogIndex, createIndex } from '@sipclock/engine';

let defaultIndex: CatalogIndex | undefined;

/** Number of recipes that are ready or need only swaps with this bar. */
export function countMakeable(bar: readonly string[], catalog: Catalog = defaultCatalog): number {
  let index: CatalogIndex;
  if (catalog === defaultCatalog) {
    defaultIndex ??= createIndex(catalog);
    index = defaultIndex;
  } else {
    index = createIndex(catalog);
  }
  const set = new Set(bar);
  let count = 0;
  for (const recipe of catalog.recipes) {
    const status = availability(recipe, set, index).status;
    if (status === 'ready' || status === 'swap') count++;
  }
  return count;
}

export function catalogIndex(): CatalogIndex {
  defaultIndex ??= createIndex(defaultCatalog);
  return defaultIndex;
}
