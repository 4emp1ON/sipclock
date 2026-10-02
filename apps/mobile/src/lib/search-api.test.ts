import type { AiError } from './ai';
import { fetchSearch, parseSearchBody } from './search-api';

const deps = (f: unknown, timeoutMs?: number) => ({
  apiUrl: 'https://api.test',
  fetch: f as typeof fetch,
  ...(timeoutMs ? { timeoutMs } : {}),
});
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const body = {
  query: 'gin',
  semantic: true,
  results: [
    { id: 'negroni', score: 0.9, field: 'name' },
    { id: 'no-such-drink', score: 0.8, field: 'name' },
    { id: 'gin-and-tonic', score: 0.5, field: 'meaning' },
  ],
};

describe('parseSearchBody', () => {
  it('drops unknown ids, duplicates and malformed hits', () => {
    const out = parseSearchBody({
      semantic: false,
      results: [
        ...body.results,
        { id: 'negroni', score: 0.1, field: 'tag' },
        { id: 'gin-and-tonic', score: 'x', field: 'tag' },
        { id: 'martini', score: 1, field: 'bogus' },
        null,
      ],
    });
    expect(out.results.map((r) => r.id)).toEqual(['negroni', 'gin-and-tonic']);
    expect(out.semantic).toBe(false);
  });

  it('rejects a body without results', () => {
    expect(() => parseSearchBody({ query: 'x' })).toThrow();
    expect(() => parseSearchBody(null)).toThrow();
  });
});

describe('fetchSearch', () => {
  it('sends a public GET with query, locale and limit', async () => {
    const f = jest.fn(async () => json(body));
    const out = await fetchSearch(deps(f), { q: '  gin & tonic ', locale: 'ru' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://api.test/v1/search');
    expect(u.searchParams.get('q')).toBe('gin & tonic');
    expect(u.searchParams.get('locale')).toBe('ru');
    expect(u.searchParams.get('limit')).toBe('30');
    expect(init.credentials).toBe('omit');
    expect((init.headers as Record<string, string>).Cookie).toBeUndefined();
    expect(out.results.map((r) => r.id)).toEqual(['negroni', 'gin-and-tonic']);
    expect(out.semantic).toBe(true);
  });

  it('cuts the query to 100 chars', async () => {
    const f = jest.fn(async () => json(body));
    await fetchSearch(deps(f), { q: 'a'.repeat(150), locale: 'en' });
    const [url] = f.mock.calls[0] as unknown as [string];
    expect(new URL(url).searchParams.get('q')).toHaveLength(100);
  });

  it('maps statuses to error kinds', async () => {
    const kind = async (status: number) =>
      fetchSearch(
        deps(async () => json({}, status)),
        { q: 'gin', locale: 'en' },
      ).catch((e: AiError) => e.kind);
    expect(await kind(429)).toBe('rate_limited');
    expect(await kind(400)).toBe('invalid');
    expect(await kind(500)).toBe('server');
  });

  it('maps a network failure and a garbled body', async () => {
    await expect(
      fetchSearch(
        deps(async () => {
          throw new Error('offline');
        }),
        { q: 'gin', locale: 'en' },
      ),
    ).rejects.toMatchObject({ kind: 'network' });
    await expect(
      fetchSearch(
        deps(async () => new Response('<html>')),
        { q: 'gin', locale: 'en' },
      ),
    ).rejects.toMatchObject({ kind: 'server' });
  });

  it('aborts after the timeout', async () => {
    const f = (_url: string, init: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    await expect(fetchSearch(deps(f, 20), { q: 'gin', locale: 'en' })).rejects.toMatchObject({
      kind: 'network',
    });
  });

  it('rejects an empty query without a request', async () => {
    const f = jest.fn();
    await expect(fetchSearch(deps(f), { q: '  ', locale: 'en' })).rejects.toMatchObject({
      kind: 'invalid',
    });
    expect(f).not.toHaveBeenCalled();
  });
});
