import { AiError, fetchSubstitutes } from './ai';

const req = { recipeId: 'negroni', ingredientId: 'campari', bar: ['gin'], locale: 'en' as const };
const body = {
  recipeId: 'negroni',
  ingredientId: 'campari',
  source: 'ai',
  suggestions: [{ ingredientId: 'aperol', inBar: true, fit: 'close', note: 'Sweeter.' }],
  canSkip: false,
};

const deps = (fetchImpl: typeof fetch, cookie = 'sid=1') => ({
  apiUrl: 'https://api.test',
  getCookie: async () => cookie,
  fetch: fetchImpl,
});

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers });

describe('fetchSubstitutes', () => {
  it('parses a success and sends the cookie and body', async () => {
    const f = jest.fn(async () => json(body));
    const out = await fetchSubstitutes(deps(f as unknown as typeof fetch), req);
    expect(out.source).toBe('ai');
    expect(out.suggestions[0]).toEqual({
      ingredientId: 'aperol',
      inBar: true,
      fit: 'close',
      note: 'Sweeter.',
    });
    expect(out.quotaRemaining).toBeNull();
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/v1/ai/substitutes');
    expect((init.headers as Record<string, string>).Cookie).toBe('sid=1');
    expect(JSON.parse(init.body as string)).toEqual(req);
  });

  it('reads the quota header', async () => {
    const f = async () =>
      json({ ...body, source: 'catalog' }, 200, { 'X-AI-Quota-Remaining': '0' });
    const out = await fetchSubstitutes(deps(f as unknown as typeof fetch), req);
    expect(out.source).toBe('catalog');
    expect(out.quotaRemaining).toBe(0);
  });

  it('maps 401 from problem+json to unauthorized', async () => {
    const f = async () =>
      json({ title: 'Unauthorized', detail: 'Sign in' }, 401, {
        'Content-Type': 'application/problem+json',
      });
    await expect(fetchSubstitutes(deps(f as unknown as typeof fetch), req)).rejects.toMatchObject({
      kind: 'unauthorized',
      status: 401,
      message: 'Sign in',
    });
  });

  it('is unauthorized without a cookie, without calling the API', async () => {
    const f = jest.fn();
    await expect(
      fetchSubstitutes(deps(f as unknown as typeof fetch, ''), req),
    ).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(f).not.toHaveBeenCalled();
  });

  it('maps a network failure', async () => {
    const f = async () => {
      throw new TypeError('Network request failed');
    };
    const err = await fetchSubstitutes(deps(f as unknown as typeof fetch), req).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.kind).toBe('network');
  });

  it('maps 429 and a non-JSON 502', async () => {
    const f429 = async () => json({ title: 'Too many' }, 429);
    await expect(
      fetchSubstitutes(deps(f429 as unknown as typeof fetch), req),
    ).rejects.toMatchObject({
      kind: 'rate_limited',
    });
    const f502 = async () => new Response('<html>bad gateway</html>', { status: 502 });
    await expect(
      fetchSubstitutes(deps(f502 as unknown as typeof fetch), req),
    ).rejects.toMatchObject({
      kind: 'server',
    });
  });

  it('aborts after the timeout', async () => {
    const f = (_u: unknown, init?: RequestInit) =>
      new Promise<Response>((_res, rej) =>
        init?.signal?.addEventListener('abort', () => rej(new Error('aborted'))),
      );
    const err = await fetchSubstitutes(
      { ...deps(f as unknown as typeof fetch), timeoutMs: 5 },
      req,
    ).catch((e) => e);
    expect(err.kind).toBe('network');
  });
});
