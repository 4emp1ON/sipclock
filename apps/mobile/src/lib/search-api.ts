import { recipesById } from '@sipclock/catalog';
import type { Locale } from '@sipclock/i18n';

import { AiError, type AiErrorKind } from './ai';

export type ApiSearchField = 'name' | 'ingredient' | 'tag' | 'description' | 'meaning';
export interface ApiSearchHit {
  id: string;
  score: number;
  field: ApiSearchField;
}
export interface ApiSearchResult {
  query: string;
  /** True when the order includes a by-meaning (embedding) match. */
  semantic: boolean;
  results: ApiSearchHit[];
}

export interface SearchDeps {
  apiUrl: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export const SEARCH_TIMEOUT_MS = 4000;
export const MAX_QUERY_CHARS = 100;
export const SEARCH_LIMIT = 30;

const FIELDS: readonly string[] = ['name', 'ingredient', 'tag', 'description', 'meaning'];

function kindForStatus(status: number): AiErrorKind {
  if (status === 429) return 'rate_limited';
  if (status >= 400 && status < 500) return 'invalid';
  return 'server';
}

/** Defensive parse: malformed hits and ids outside the bundled catalog are dropped. */
export function parseSearchBody(body: unknown, fallbackQuery = ''): ApiSearchResult {
  if (typeof body !== 'object' || body === null) throw new Error('bad body');
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.results)) throw new Error('no results');
  const results: ApiSearchHit[] = [];
  const seen = new Set<string>();
  for (const raw of b.results) {
    if (typeof raw !== 'object' || raw === null) continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || !recipesById.has(r.id) || seen.has(r.id)) continue;
    if (typeof r.score !== 'number' || !Number.isFinite(r.score)) continue;
    if (typeof r.field !== 'string' || !FIELDS.includes(r.field)) continue;
    seen.add(r.id);
    results.push({ id: r.id, score: r.score, field: r.field as ApiSearchField });
  }
  return {
    query: typeof b.query === 'string' ? b.query : fallbackQuery,
    semantic: b.semantic === true,
    results,
  };
}

/**
 * `GET /v1/search?q&locale&limit`: public, no cookie. Throws `AiError`: 'rate_limited' (429), 'invalid'
 * (other 4xx, e.g. a bad query), 'server', 'network' (including the timeout).
 */
export async function fetchSearch(
  deps: SearchDeps,
  req: { q: string; locale: Locale; limit?: number },
): Promise<ApiSearchResult> {
  const q = req.q.trim().slice(0, MAX_QUERY_CHARS);
  if (q === '') throw new AiError('invalid', null, 'empty query');
  const params = new URLSearchParams({
    q,
    locale: req.locale,
    limit: String(req.limit ?? SEARCH_LIMIT),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? SEARCH_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await (deps.fetch ?? fetch)(`${deps.apiUrl}/v1/search?${params.toString()}`, {
        method: 'GET',
        credentials: 'omit',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
    } catch (e) {
      throw new AiError('network', null, e instanceof Error ? e.message : 'network error');
    }
    if (!res.ok) throw new AiError(kindForStatus(res.status), res.status, `search ${res.status}`);
    try {
      return parseSearchBody(await res.json(), q);
    } catch {
      throw new AiError('server', res.status, 'unreadable response');
    }
  } finally {
    clearTimeout(timer);
  }
}
