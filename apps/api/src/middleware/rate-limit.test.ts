import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createMemoryRateLimitStore, rateLimit } from './rate-limit.ts';

function setup(opts: { limit?: number; trustedProxyHops?: number; edgeProxySecret?: string } = {}) {
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
      trustedProxyHops: opts.trustedProxyHops ?? 0,
      edgeProxySecret: opts.edgeProxySecret,
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

  it('keys by the X-Forwarded-For entry appended by the trusted proxy, not client-supplied ones', async () => {
    const trusted = setup({ limit: 1, trustedProxyHops: 1 });
    // The proxy appends the real address (203.0.113.9); the client rotates spoofed entries on the left.
    await trusted.app.request('/', { headers: { 'x-forwarded-for': '10.0.0.1, 203.0.113.9' } });
    expect(
      (await trusted.app.request('/', { headers: { 'x-forwarded-for': '10.0.0.2, 203.0.113.9' } }))
        .status,
    ).toBe(429);
    expect(
      (await trusted.app.request('/', { headers: { 'x-forwarded-for': '198.51.100.7' } })).status,
    ).toBe(200);

    const twoHops = setup({ limit: 1, trustedProxyHops: 2 });
    await twoHops.app.request('/', {
      headers: { 'x-forwarded-for': 'spoof, 203.0.113.9, 10.1.1.1' },
    });
    expect(
      (
        await twoHops.app.request('/', {
          headers: { 'x-forwarded-for': 'other, 203.0.113.9, 10.1.1.2' },
        })
      ).status,
    ).toBe(429);

    const untrusted = setup({ limit: 1 });
    await untrusted.app.request('/', { headers: { 'x-forwarded-for': '1.1.1.1' } });
    expect(
      (await untrusted.app.request('/', { headers: { 'x-forwarded-for': '2.2.2.2' } })).status,
    ).toBe(429);
  });

  describe('edge proxy client IP', () => {
    const secret = 's'.repeat(40);
    const via = (ip: string, proxySecret = secret) => ({
      headers: { 'x-sipclock-proxy-secret': proxySecret, 'x-sipclock-client-ip': ip },
    });

    it('keys by X-Sipclock-Client-Ip when the proxy secret matches', async () => {
      const { app } = setup({ limit: 1, edgeProxySecret: secret });
      expect((await app.request('/', via('203.0.113.1'))).status).toBe(200);
      // Another client behind the same proxy has its own budget.
      expect((await app.request('/', via('203.0.113.2'))).status).toBe(200);
      expect((await app.request('/', via('203.0.113.1'))).status).toBe(429);
    });

    it('ignores X-Sipclock-Client-Ip with a wrong or missing secret', async () => {
      const { app } = setup({ limit: 1, edgeProxySecret: secret });
      await app.request('/', via('203.0.113.1', 'wrong'));
      // Rotating the claimed IP does not help: everything falls back to the socket address.
      expect((await app.request('/', via('203.0.113.2', 'wrong'))).status).toBe(429);
      expect(
        (await app.request('/', { headers: { 'x-sipclock-client-ip': '203.0.113.3' } })).status,
      ).toBe(429);
    });

    it('ignores the headers entirely when no secret is configured', async () => {
      const { app } = setup({ limit: 1 });
      await app.request('/', via('203.0.113.1'));
      expect((await app.request('/', via('203.0.113.2'))).status).toBe(429);
    });
  });

  it('caps the number of tracked keys', async () => {
    const store = createMemoryRateLimitStore({ cleanupIntervalMs: 0, maxKeys: 3 });
    for (let i = 0; i < 10; i++) await store.hit(`k${i}`, 60_000);
    expect(store.size()).toBe(3);
    store.close();
  });
});
