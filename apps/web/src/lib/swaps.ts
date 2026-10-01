// Pure helpers for "Find a swap" (POST /api/ai/substitutes, proxied to /v1/ai/substitutes).

export interface SwapSuggestion {
  ingredientId: string;
  inBar: boolean;
  fit: 'close' | 'workable';
  note?: string;
}

export interface SwapAnswer {
  recipeId: string;
  ingredientId: string;
  source: 'ai' | 'catalog';
  suggestions: SwapSuggestion[];
  canSkip: boolean;
}

export type SwapResult =
  | { kind: 'ok'; answer: SwapAnswer; limitReached: boolean }
  | { kind: 'unauthorized' }
  | { kind: 'error' };

export const MAX_BAR = 300;
export const MAX_SUGGESTIONS = 3;

/** Ingredients missing from the bar come first; order is otherwise kept. */
export function orderChips(ids: readonly string[], bar: readonly string[]): string[] {
  const have = new Set(bar);
  return [...ids.filter((id) => !have.has(id)), ...ids.filter((id) => have.has(id))];
}

/** `source: 'catalog'` with a remaining quota of exactly '0' means the daily AI limit was hit. */
export function isLimitReached(source: SwapAnswer['source'], quotaHeader: string | null): boolean {
  return source === 'catalog' && quotaHeader?.trim() === '0';
}

export async function fetchSwaps(
  fetchFn: typeof fetch,
  input: { recipeId: string; ingredientId: string; bar: readonly string[]; locale: 'en' | 'ru' },
  signal?: AbortSignal,
): Promise<SwapResult> {
  try {
    const res = await fetchFn('/api/ai/substitutes', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ ...input, bar: input.bar.slice(0, MAX_BAR) }),
      signal,
    });
    if (res.status === 401) return { kind: 'unauthorized' };
    if (!res.ok) return { kind: 'error' };
    const answer = (await res.json()) as SwapAnswer;
    if (!Array.isArray(answer.suggestions)) return { kind: 'error' };
    return {
      kind: 'ok',
      answer,
      limitReached: isLimitReached(answer.source, res.headers.get('x-ai-quota-remaining')),
    };
  } catch {
    return { kind: 'error' };
  }
}
