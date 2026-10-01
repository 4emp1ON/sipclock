import { describe, expect, it, vi } from 'vitest';
import { fetchSwaps, isLimitReached, orderChips } from './swaps';

const input = { recipeId: 'negroni', ingredientId: 'gin', bar: ['campari'], locale: 'en' as const };
const answer = {
  recipeId: 'negroni',
  ingredientId: 'gin',
  source: 'catalog',
  suggestions: [],
  canSkip: false,
};
const respond = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  vi.fn(async () => Response.json(body, { status, headers }));

describe('orderChips', () => {
  it('puts ingredients missing from the bar first, keeping order', () => {
    expect(orderChips(['a', 'b', 'c', 'd'], ['b', 'd'])).toEqual(['a', 'c', 'b', 'd']);
  });
});

describe('isLimitReached', () => {
  it('only for catalog answers with quota 0', () => {
    expect(isLimitReached('catalog', '0')).toBe(true);
    expect(isLimitReached('catalog', null)).toBe(false);
    expect(isLimitReached('ai', '0')).toBe(false);
    expect(isLimitReached('catalog', '3')).toBe(false);
  });
});

describe('fetchSwaps', () => {
  it('posts JSON and reads the quota header', async () => {
    const f = respond(200, answer, { 'x-ai-quota-remaining': '0' });
    const r = await fetchSwaps(f as unknown as typeof fetch, input);
    expect(r).toMatchObject({ kind: 'ok', limitReached: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/ai/substitutes');
    expect(JSON.parse(init.body as string)).toEqual(input);
  });
  it('maps 401 to unauthorized and other failures to error', async () => {
    expect(await fetchSwaps(respond(401, {}) as unknown as typeof fetch, input)).toEqual({
      kind: 'unauthorized',
    });
    expect(await fetchSwaps(respond(503, {}) as unknown as typeof fetch, input)).toEqual({
      kind: 'error',
    });
    expect(await fetchSwaps(respond(200, {}) as unknown as typeof fetch, input)).toEqual({
      kind: 'error',
    });
    const boom = vi.fn(async () => {
      throw new Error('net');
    });
    expect(await fetchSwaps(boom as unknown as typeof fetch, input)).toEqual({ kind: 'error' });
  });
});
