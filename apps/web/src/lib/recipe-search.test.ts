import { describe, expect, it } from 'vitest';
import {
  apiSearchUrl,
  applyFilters,
  isSearchable,
  normalizeQuery,
  parseSearchResponse,
  readQueryParam,
  withQueryParam,
} from './recipe-search';

const known = new Set(['negroni', 'mojito', 'virgin-mojito']);

describe('query handling', () => {
  it('normalizes and gates on 2 characters', () => {
    expect(normalizeQuery('  fresh   with mint ')).toBe('fresh with mint');
    expect(normalizeQuery('x'.repeat(150))).toHaveLength(100);
    expect(isSearchable(' a ')).toBe(false);
    expect(isSearchable('ab')).toBe(true);
  });
  it('reads and writes ?q= keeping other params', () => {
    expect(readQueryParam('?q=fresh%20mint')).toBe('fresh mint');
    expect(readQueryParam('')).toBe('');
    expect(withQueryParam('', 'gin tonic')).toBe('?q=gin+tonic');
    expect(withQueryParam('?a=1&q=x', '')).toBe('?a=1');
    expect(withQueryParam('?q=x', '')).toBe('');
  });
  it('builds the proxy URL', () => {
    expect(apiSearchUrl(' свежее с мятой ', 'ru')).toBe(
      '/api/search?q=%D1%81%D0%B2%D0%B5%D0%B6%D0%B5%D0%B5+%D1%81+%D0%BC%D1%8F%D1%82%D0%BE%D0%B9&locale=ru&limit=30',
    );
  });
});

describe('parseSearchResponse', () => {
  it('keeps API order and drops unknown ids and duplicates', () => {
    const r = parseSearchResponse(
      {
        query: 'x',
        semantic: true,
        results: [
          { id: 'mojito', score: 1, field: 'name' },
          { id: 'ghost', score: 0.9, field: 'name' },
          { id: 'negroni', score: 0.5, field: 'meaning' },
          { id: 'mojito', score: 0.4, field: 'tag' },
        ],
      },
      known,
    );
    expect(r).toEqual({
      semantic: true,
      hits: [
        { id: 'mojito', field: 'name' },
        { id: 'negroni', field: 'meaning' },
      ],
    });
  });
  it('returns null for malformed bodies', () => {
    expect(parseSearchResponse(null, known)).toBeNull();
    expect(parseSearchResponse({ results: [{ id: 1 }] }, known)).toBeNull();
    expect(parseSearchResponse({ results: [{ id: 'mojito', field: 'bogus' }] }, known)).toBeNull();
  });
});

describe('applyFilters', () => {
  const cards = new Map([
    ['negroni', { id: 'negroni', abv: 24, occasions: ['aperitivo'] }],
    ['mojito', { id: 'mojito', abv: 10, occasions: ['party'] }],
    ['virgin-mojito', { id: 'virgin-mojito', abv: 0, occasions: ['party'] }],
  ]);
  const hits = [
    { id: 'mojito', field: 'name' as const },
    { id: 'negroni', field: 'name' as const },
    { id: 'virgin-mojito', field: 'meaning' as const },
    { id: 'gone', field: 'tag' as const },
  ];
  it('keeps ranking and skips cards that are not in the page', () => {
    expect(
      applyFilters(hits, cards, { occasion: null, zero: false }).map((x) => x.card.id),
    ).toEqual(['mojito', 'negroni', 'virgin-mojito']);
  });
  it('applies occasion and alcohol-free', () => {
    expect(
      applyFilters(hits, cards, { occasion: 'party', zero: false }).map((x) => x.card.id),
    ).toEqual(['mojito', 'virgin-mojito']);
    expect(
      applyFilters(hits, cards, { occasion: 'party', zero: true }).map((x) => x.card.id),
    ).toEqual(['virgin-mojito']);
  });
});
