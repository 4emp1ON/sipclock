// Pure helpers for recipe search on /recipes: query handling, the untrusted API response, and ordering.
import { z } from 'zod';

export const MIN_QUERY = 2;
export const MAX_QUERY = 100;
export const SEARCH_LIMIT = 30;
export const DEBOUNCE_MS = 250;

export type SearchField = 'name' | 'ingredient' | 'tag' | 'description' | 'meaning';

export interface RankedHit {
  id: string;
  field: SearchField;
}

/** Trims, collapses spaces and caps at the API limit. */
export function normalizeQuery(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY);
}

/** A query is searched only from 2 characters. */
export function isSearchable(query: string): boolean {
  return normalizeQuery(query).length >= MIN_QUERY;
}

/** `?q=` value from a location search string; empty when absent. */
export function readQueryParam(search: string): string {
  return normalizeQuery(new URLSearchParams(search).get('q') ?? '');
}

/** The same search string with `q` set (or removed when empty); other params are kept. */
export function withQueryParam(search: string, query: string): string {
  const params = new URLSearchParams(search);
  const q = normalizeQuery(query);
  if (q) params.set('q', q);
  else params.delete('q');
  const out = params.toString();
  return out ? `?${out}` : '';
}

/** Same-origin proxy URL for the API search. */
export function apiSearchUrl(query: string, locale: string, limit = SEARCH_LIMIT): string {
  const params = new URLSearchParams({ q: normalizeQuery(query), locale, limit: String(limit) });
  return `/api/search?${params.toString()}`;
}

const responseSchema = z.object({
  query: z.string().optional(),
  semantic: z.boolean().optional(),
  results: z.array(
    z.object({
      id: z.string(),
      score: z.number().optional(),
      field: z.enum(['name', 'ingredient', 'tag', 'description', 'meaning']),
    }),
  ),
});

/** Validates an untrusted response; unknown ids (not in `knownIds`) and duplicates are dropped. Null when malformed. */
export function parseSearchResponse(
  body: unknown,
  knownIds: ReadonlySet<string>,
): { semantic: boolean; hits: RankedHit[] } | null {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) return null;
  const seen = new Set<string>();
  const hits: RankedHit[] = [];
  for (const r of parsed.data.results) {
    if (!knownIds.has(r.id) || seen.has(r.id)) continue;
    seen.add(r.id);
    hits.push({ id: r.id, field: r.field });
  }
  return { semantic: parsed.data.semantic ?? false, hits };
}

export interface Filterable {
  id: string;
  abv: number;
  occasions: string[];
}

/** Applies the occasion chip and alcohol-free toggle over ranked hits, keeping the ranking. */
export function applyFilters<C extends Filterable>(
  hits: readonly RankedHit[],
  cardsById: ReadonlyMap<string, C>,
  filters: { occasion: string | null; zero: boolean },
): { card: C; field: SearchField }[] {
  const out: { card: C; field: SearchField }[] = [];
  for (const h of hits) {
    const card = cardsById.get(h.id);
    if (!card) continue;
    if (filters.occasion && !card.occasions.includes(filters.occasion)) continue;
    if (filters.zero && card.abv !== 0) continue;
    out.push({ card, field: h.field });
  }
  return out;
}
