import type { Locale } from '@sipclock/i18n';

export interface SubstitutesRequest {
  recipeId: string;
  ingredientId: string;
  /** Ingredient ids at home (the API accepts at most 300). */
  bar: string[];
  locale: Locale;
}

export interface Suggestion {
  ingredientId: string;
  inBar: boolean;
  fit: 'close' | 'workable';
  note?: string;
}

export interface SubstitutesResult {
  recipeId: string;
  ingredientId: string;
  source: 'ai' | 'catalog';
  suggestions: Suggestion[];
  canSkip: boolean;
  /** From `X-AI-Quota-Remaining`; null when the answer came from cache or the catalog. */
  quotaRemaining: number | null;
}

export type AiErrorKind = 'unauthorized' | 'rate_limited' | 'invalid' | 'server' | 'network';

export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export interface AiDeps {
  apiUrl: string;
  /** Better Auth session cookie header value; empty when signed out. */
  getCookie: () => Promise<string>;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export const AI_TIMEOUT_MS = 30_000;
export const MAX_BAR_IDS = 300;

function kindForStatus(status: number): AiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 429) return 'rate_limited';
  if (status >= 400 && status < 500) return 'invalid';
  return 'server';
}

/** Best-effort message from an `application/problem+json` body; never throws. */
async function problemMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown; title?: unknown };
    for (const v of [body.detail, body.title]) if (typeof v === 'string' && v) return v;
  } catch {
    // Not JSON (a proxy error page): the status is enough.
  }
  return `request failed: ${res.status}`;
}

function parseSuggestions(value: unknown): Suggestion[] {
  if (!Array.isArray(value)) throw new Error('no suggestions');
  return value.map((raw) => {
    const s = raw as Partial<Suggestion>;
    if (typeof s.ingredientId !== 'string') throw new Error('bad suggestion');
    return {
      ingredientId: s.ingredientId,
      inBar: s.inBar === true,
      fit: s.fit === 'close' ? 'close' : 'workable',
      ...(typeof s.note === 'string' && s.note ? { note: s.note } : {}),
    };
  });
}

/** `POST /v1/ai/substitutes`. Throws `AiError`; a 401 has kind 'unauthorized' (treat as signed out). */
export async function fetchSubstitutes(
  deps: AiDeps,
  req: SubstitutesRequest,
): Promise<SubstitutesResult> {
  const cookie = await deps.getCookie();
  if (!cookie) throw new AiError('unauthorized', null, 'not signed in');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? AI_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await (deps.fetch ?? fetch)(`${deps.apiUrl}/v1/ai/substitutes`, {
        method: 'POST',
        credentials: 'omit',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Cookie: cookie },
        body: JSON.stringify({ ...req, bar: req.bar.slice(0, MAX_BAR_IDS) }),
      });
    } catch (e) {
      throw new AiError('network', null, e instanceof Error ? e.message : 'network error');
    }
    if (!res.ok)
      throw new AiError(kindForStatus(res.status), res.status, await problemMessage(res));

    try {
      const body = (await res.json()) as Record<string, unknown>;
      const header = res.headers.get('X-AI-Quota-Remaining');
      const quota = header === null || header.trim() === '' ? Number.NaN : Number(header);
      return {
        recipeId: String(body.recipeId ?? req.recipeId),
        ingredientId: String(body.ingredientId ?? req.ingredientId),
        source: body.source === 'ai' ? 'ai' : 'catalog',
        suggestions: parseSuggestions(body.suggestions),
        canSkip: body.canSkip === true,
        quotaRemaining: Number.isFinite(quota) ? quota : null,
      };
    } catch (e) {
      if (e instanceof AiError) throw e;
      // A 200 that is not our JSON, or a body cut off mid-read.
      throw new AiError('server', res.status, 'unreadable response');
    }
  } finally {
    clearTimeout(timer);
  }
}
