import { catalog } from '@sipclock/catalog';
import { describe, expect, it } from 'vitest';
import { createIndex } from './graph.ts';
import { createRecipeSearcher, searchWords, wordMatches } from './search.ts';

const searcher = createRecipeSearcher(createIndex(catalog));
const ids = (q: string, limit = 5) => searcher.search(q, { limit }).map((h) => h.recipeId);

describe('wordMatches', () => {
  it('matches prefixes while typing and Russian endings', () => {
    expect(wordMatches('negr', 'negroni')).toBe(true);
    expect(wordMatches('мятой', 'мята')).toBe(true);
    expect(wordMatches('джином', 'джин')).toBe(true);
    expect(wordMatches('сок', 'сода')).toBe(false);
    expect(wordMatches('ром', 'розмарин')).toBe(false);
    // A finished word is not a prefix: "gin lime" must not find ginger.
    expect(wordMatches('gin', 'ginger', false)).toBe(false);
    expect(wordMatches('gin', 'ginger', true)).toBe(true);
    expect(wordMatches('warm', 'ward', false)).toBe(false);
    expect(wordMatches('lemons', 'lemon', false)).toBe(true);
  });

  it('normalizes case, ё and punctuation', () => {
    expect(searchWords('Тёмный ром, ЛАЙМ!')).toEqual(['темный', 'ром', 'лайм']);
  });
});

describe('createRecipeSearcher', () => {
  it('finds a recipe by its name in either language', () => {
    expect(ids('negroni')[0]).toBe('negroni');
    expect(ids('Негрони')[0]).toBe('negroni');
    expect(ids('пина колада')[0]).toBe('pina-colada');
  });

  it('ranks recipes that match more of the query first', () => {
    const hits = searcher.search('gin lime mint');
    const [top] = hits;
    expect(top?.matched).toBe(3);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1]?.matched ?? 0).toBeGreaterThanOrEqual(hits[i]?.matched ?? 0);
    }
  });

  it('finds recipes by an ingredient, including through a generic parent', () => {
    expect(ids('mint', 20)).toContain('mojito');
    expect(ids('с мятой', 20)).toContain('mojito');
    // "rum" covers white rum.
    expect(ids('rum', 50)).toContain('daiquiri');
  });

  it('prefers whole words to a prefix of the word being typed', () => {
    const top = ids('gin', 3);
    expect(top).not.toContain('ginger-lime-mule');
    // It still matches "lime", but "gin" no longer counts.
    const mule = searcher
      .search('gin lime', { limit: 50 })
      .find((h) => h.recipeId === 'ginger-lime-mule');
    expect(mule?.matched).toBe(1);
  });

  it('ignores filler words and returns nothing for an empty query', () => {
    expect(searcher.search('')).toEqual([]);
    expect(searcher.search('a drink with')).toEqual([]);
  });
});
