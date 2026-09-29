import type { Catalog, Ingredient, Recipe } from '@sipclock/domain';

const EMPTY: readonly string[] = Object.freeze([]);

/** Precomputed lookups over a catalog. Build once per catalog with {@link createIndex}. */
export interface CatalogIndex {
  readonly catalogVersion: string;
  readonly ingredients: ReadonlyMap<string, Ingredient>;
  readonly recipes: ReadonlyMap<string, Recipe>;
  /** Parent chain of an ingredient, nearest first (`london-dry-gin` → `['gin']`). */
  readonly ancestors: ReadonlyMap<string, readonly string[]>;
  /** Every ingredient that has the key somewhere up its parent chain. */
  readonly descendants: ReadonlyMap<string, readonly string[]>;
}

export function createIndex(catalog: Catalog): CatalogIndex {
  const ingredients = new Map<string, Ingredient>();
  for (const ing of catalog.ingredients) ingredients.set(ing.id, ing);
  const recipes = new Map<string, Recipe>();
  for (const r of catalog.recipes) recipes.set(r.id, r);

  const ancestors = new Map<string, string[]>();
  const descendants = new Map<string, string[]>();
  for (const ing of catalog.ingredients) {
    const chain: string[] = [];
    const seen = new Set<string>([ing.id]);
    let parent = ing.parent;
    while (parent !== undefined && !seen.has(parent)) {
      chain.push(parent);
      seen.add(parent);
      parent = ingredients.get(parent)?.parent;
    }
    ancestors.set(ing.id, chain);
    for (const a of chain) {
      const list = descendants.get(a);
      if (list) list.push(ing.id);
      else descendants.set(a, [ing.id]);
    }
  }
  return { catalogVersion: catalog.version, ingredients, recipes, ancestors, descendants };
}

export function ancestorsOf(index: CatalogIndex, id: string): readonly string[] {
  return index.ancestors.get(id) ?? EMPTY;
}

export function descendantsOf(index: CatalogIndex, id: string): readonly string[] {
  return index.descendants.get(id) ?? EMPTY;
}

export function isStaple(index: CatalogIndex, id: string): boolean {
  return index.ingredients.get(id)?.staple === true;
}

/**
 * Does having `barId` at home cover a recipe need of `needId`?
 * True for the same id, when one is an ancestor of the other (generic `gin` ⇄ `london-dry-gin`),
 * or when the need can be made from what is at home (`lemon` covers `lemon-juice`).
 * Siblings do not satisfy each other.
 */
export function satisfies(barId: string, needId: string, index: CatalogIndex): boolean {
  if (barId === needId) return true;
  if (ancestorsOf(index, needId).includes(barId) || ancestorsOf(index, barId).includes(needId)) {
    return true;
  }
  const source = index.ingredients.get(needId)?.madeFrom;
  return source !== undefined && source !== needId && satisfies(barId, source, index);
}
