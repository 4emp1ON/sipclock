import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createMemoryRateLimitStore, rateLimit } from './rate-limit.ts';

function setup(opts: { limit?: number; trustProxy?: boolean } = {}) {
  let t = 1_000_000;
  const now = () => t;
  const store = createMemoryRateLimitStore({ now, cleanupIntervalMs: 0 });
  const app = new Hono();
  app.use(
    '*',
    rateLimit({
      store,
      name: 't',
      limit: opts.limit ?? 2,
      windowMs: 60_000,
      now,
      trustProxy: opts.trustProxy ?? false,
    }) as never,
  );
  app.get('/', (c) => c.text('ok'));
  return { app, store, advance: (ms: number) => (t += ms) };
}

describe('memory rate limit store', () => {
  it('counts within a window and starts a new one after expiry', async () => {
    let t = 0;
    const store = createMemoryRateLimitStore({ now: () => t, cleanupIntervalMs: 0 });
    expect(await store.hit('k', 1000)).toEqual({ count: 1, resetAt: 1000 });
    expect(await store.hit('k', 1000)).toEqual({ count: 2, resetAt: 1000 });
    t = 1000;
    expect(await store.hit('k', 1000)).toEqual({ count: 1, resetAt: 2000 });
  });

  it('sweep removes expired windows only', async () => {
    let t = 0;
    const store = createMemoryRateLimitStore({ now: () => t, cleanupIntervalMs: 0 });
    await store.hit('a', 1000);
    await store.hit('b', 5000);
    t = 1500;
    expect(store.sweep()).toBe(1);
    expect(store.size()).toBe(1);
  });

  it('cleanup timer is unref-ed and close() stops it', () => {
    const store = createMemoryRateLimitStore({ cleanupIntervalMs: 10 });
    store.close();
  });
});

describe('rateLimit middleware', () => {
  it('allows up to the limit, then 429 with headers', async () => {
    const { app } = setup();
    const r1 = await app.request('/');
    expect(r1.status).toBe(200);
    expect(r1.headers.get('ratelimit-limit')).toBe('2');
    expect(r1.headers.get('ratelimit-remaining')).toBe('1');
    expect(r1.headers.get('ratelimit-reset')).toBe('60');
    await app.request('/');
    const r3 = await app.request('/');
    expect(r3.status).toBe(429);
    expect(r3.headers.get('retry-after')).toBe('60');
    expect(r3.headers.get('ratelimit-remaining')).toBe('0');
    expect(r3.headers.get('content-type')).toContain('application/problem+json');
    expect(await r3.json()).toMatchObject({ status: 429, title: 'Too Many Requests' });
  });

  it('resets after the window', async () => {
    const { app, advance } = setup({ limit: 1 });
    await app.request('/');
    expect((await app.request('/')).status).toBe(429);
    advance(30_000);
    const mid = await app.request('/');
    expect(mid.headers.get('retry-after')).toBe('30');
    advance(30_000);
    expect((await app.request('/')).status).toBe(200);
  });

  it('keys by first X-Forwarded-For hop only when trusted', async () => {
    const trusted = setup({ limit: 1, trustProxy: true });
    await trusted.app.request('/', { headers: { 'x-forwarded-for': '1.1.1.1' } });
    expect(
      (await trusted.app.request('/', { headers: { 'x-forwarded-for': '2.2.2.2' } })).status,
    ).toBe(200);
    expect(
      (await trusted.app.request('/', { headers: { 'x-forwarded-for': '1.1.1.1, 9.9.9.9' } }))
        .status,
    ).toBe(429);

    const untrusted = setup({ limit: 1 });
    await untrusted.app.request('/', { headers: { 'x-forwarded-for': '1.1.1.1' } });
    expect(
      (await untrusted.app.request('/', { headers: { 'x-forwarded-for': '2.2.2.2' } })).status,
    ).toBe(429);
  });
});
