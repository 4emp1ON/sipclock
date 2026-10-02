import type { Recipe } from '@sipclock/domain';
import type { CatalogIndex } from './graph.ts';

// Lexical recipe search over the bundled catalog: the offline answer on every client and the lexical half
// of the API's hybrid search. Pure and synchronous; build the searcher once per catalog.

export type SearchField = 'name' | 'ingredient' | 'tag' | 'description';

export interface SearchHit {
  recipeId: string;
  /** How many query words matched somewhere in the recipe. */
  matched: number;
  score: number;
  /** The strongest field any word matched in. */
  field: SearchField;
}

const WEIGHT: Record<SearchField, number> = { name: 4, ingredient: 3, tag: 2, description: 1 };

// Words that carry no meaning on their own. "без" (without) and "no" stay: they change the query.
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'or',
  'the',
  'with',
  'for',
  'of',
  'to',
  'in',
  'something',
  'some',
  'drink',
  'cocktail',
  'и',
  'или',
  'с',
  'со',
  'для',
  'на',
  'в',
  'что',
  'то',
  'нибудь',
  'что-то',
  'что-нибудь',
  'напиток',
  'коктейль',
]);

/** Lower case, `ё` as `е`, letters and digits only. */
export function searchWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ё/gu, 'е')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2);
}

/** The query words the searcher matches: {@link searchWords} without filler words. */
export function queryWords(query: string): string[] {
  return searchWords(query).filter((w) => !STOP_WORDS.has(w));
}

const CYRILLIC = /\p{Script=Cyrillic}/u;

const commonPrefix = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
};

/**
 * How well a query word matches a recipe word: 1 for the same word or the same stem with another ending,
 * which Russian needs ("мятой" → "мята", "джином" → "джин"); 0.5 for a prefix of the word still being typed
 * ("negr" → "negroni"); 0 otherwise. A finished word is never a prefix: "gin" does not find "ginger".
 */
export function matchStrength(query: string, word: string, typing: boolean): number {
  if (word === query) return 1;
  const shared = commonPrefix(query, word);
  const sameStem = shared >= 3 && shared >= Math.max(query.length, word.length) - 2;
  // Russian swaps endings ("мята" ↔ "мятой"); English only adds them ("lemon" ↔ "lemons"), so a Latin word
  // must extend the other: "warm" and "ward" share a stem by length but not by meaning.
  const extends_ = word.startsWith(query) || query.startsWith(word);
  if (sameStem && (CYRILLIC.test(query) || extends_)) return 1;
  return typing && word.startsWith(query) ? 0.5 : 0;
}

/** Does a query word match a recipe word, counting a prefix of the word being typed? */
export function wordMatches(query: string, word: string, typing = true): boolean {
  return matchStrength(query, word, typing) > 0;
}

export interface RecipeSearcher {
  search(query: string, opts?: { limit?: number }): SearchHit[];
}

export function createRecipeSearcher(index: CatalogIndex): RecipeSearcher {
  const docs = [...index.recipes.values()].map((recipe) => ({
    recipe,
    fields: fieldsOf(recipe, index),
  }));

  return {
    search(query, opts = {}) {
      const words = queryWords(query);
      if (words.length === 0) return [];
      const hits: SearchHit[] = [];
      for (const { recipe, fields } of docs) {
        let matched = 0;
        let score = 0;
        let best: SearchField | undefined;
        for (const [i, q] of words.entries()) {
          // Only the last word may still be being typed.
          const typing = i === words.length - 1;
          let wordBest: SearchField | undefined;
          let strength = 0;
          for (const field of ['name', 'ingredient', 'tag', 'description'] as const) {
            const s = Math.max(0, ...fields[field].map((w) => matchStrength(q, w, typing)));
            if (s > 0) {
              wordBest = field;
              strength = s;
              break;
            }
          }
          if (wordBest === undefined) continue;
          matched++;
          score += WEIGHT[wordBest] * strength;
          if (best === undefined || WEIGHT[wordBest] > WEIGHT[best]) best = wordBest;
        }
        if (best !== undefined) hits.push({ recipeId: recipe.id, matched, score, field: best });
      }
      // Recipes matching more of the query first, then stronger fields; ties keep catalog order.
      hits.sort((a, b) => b.matched - a.matched || b.score - a.score);
      return hits.slice(0, opts.limit ?? 20);
    },
  };
}

function fieldsOf(recipe: Recipe, index: CatalogIndex): Record<SearchField, string[]> {
  const ingredientWords = recipe.ingredients.flatMap((line) => {
    const ing = index.ingredients.get(line.ingredient);
    // A generic word finds the specific bottle: "rum" matches a recipe with white rum.
    const names = [
      ing,
      ...(index.ancestors.get(line.ingredient) ?? []).map((id) => index.ingredients.get(id)),
    ].flatMap((i) => (i ? [i.name.en, i.name.ru] : []));
    return searchWords([line.ingredient, ...names].join(' '));
  });
  return {
    name: searchWords(`${recipe.name.en} ${recipe.name.ru}`),
    ingredient: ingredientWords,
    tag: searchWords(
      [
        ...recipe.tags.flavors,
        ...recipe.tags.occasions,
        ...recipe.tags.weather,
        ...recipe.tags.dayparts,
        recipe.glass,
        recipe.method,
      ].join(' '),
    ),
    description: searchWords(`${recipe.description.en} ${recipe.description.ru}`),
  };
}
