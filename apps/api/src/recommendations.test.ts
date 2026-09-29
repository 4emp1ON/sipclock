import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { silentLogger } from './lib/logger.ts';
import { createMemoryRateLimitStore } from './middleware/rate-limit.ts';
import { createBundledCatalogService } from './services/catalog.ts';

const catalog = createBundledCatalogService();

function makeApp(perMin = 60) {
  return createApp({
    env: {
      CORS_ORIGINS: [],
      NODE_ENV: 'test',
      TRUST_PROXY_HOPS: 1,
      RATE_LIMIT_RECOMMEND_PER_MIN: perMin,
    },
    catalog,
    rateLimitStore: createMemoryRateLimitStore({ cleanupIntervalMs: 0 }),
    auth: { handler: async () => new Response('ok') },
    ping: async () => {},
    logger: silentLogger,
  });
}

const friday = {
  year: 2026,
  month: 9,
  day: 25,
  weekday: 5,
  hour: 19,
  minute: 0,
  hemisphere: 'north',
};

function post(
  app: ReturnType<typeof makeApp>,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return app.request('/v1/recommendations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /v1/recommendations', () => {
  it('picks gin-and-tonic for a warm Friday evening with a gin bar', async () => {
    const res = await post(makeApp(), {
      moment: friday,
      weather: { tempC: 27, condition: 'clear' },
      bar: ['gin', 'tonic-water', 'lemon'],
      seed: 1,
      alternatives: 3,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as {
      pick: { recipeId: string } | null;
      alternatives: { recipeId: string; abv: number }[];
      recipes: { id: string; glass: string; method: string; name: { en: string } }[];
      catalogVersion: string;
    };
    expect(body.pick?.recipeId).toBe('gin-and-tonic');
    expect(body.alternatives.some((a) => a.abv === 0)).toBe(true);
    expect(body.catalogVersion).toBe(catalog.catalog.version);
    const ids = [body.pick?.recipeId, ...body.alternatives.map((a) => a.recipeId)].sort();
    expect(body.recipes.map((r) => r.id).sort()).toEqual(ids);
    expect(body.recipes[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), glass: expect.any(String) }),
    );
  });

  it('accepts a minimal body (weather and bar default to null)', async () => {
    const res = await post(makeApp(), { moment: friday, seed: 7 });
    expect(res.status).toBe(200);
  });

  it('400s on an invalid moment with field errors', async () => {
    const res = await post(makeApp(), { moment: { ...friday, hour: 25 }, seed: 1 });
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    const body = (await res.json()) as { errors: { field: string }[] };
    expect(body.errors.map((e) => e.field)).toContain('moment.hour');
  });

  it('400s with details on unknown ingredient and recipe ids', async () => {
    const res = await post(makeApp(), {
      moment: friday,
      bar: ['gin', 'unobtainium'],
      recent: ['no-such-drink'],
      seed: 1,
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    const body = (await res.json()) as {
      type: string;
      errors: { field: string; message: string; code: string }[];
    };
    expect(body.type).toBe('https://sipclock.app/problems/unknown-ids');
    expect(body.errors).toEqual([
      { field: 'bar.1', message: 'Unknown ingredient id "unobtainium"', code: 'unknown_id' },
      { field: 'recent.0', message: 'Unknown recipe id "no-such-drink"', code: 'unknown_id' },
    ]);
  });

  it('429s with problem+json and rate limit headers past the limit', async () => {
    const app = makeApp(2);
    const ip = { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' };
    const body = { moment: friday, seed: 1 };
    const first = await post(app, body, ip);
    expect(first.status).toBe(200);
    expect(first.headers.get('ratelimit-limit')).toBe('2');
    expect(first.headers.get('ratelimit-remaining')).toBe('1');
    expect((await post(app, body, ip)).status).toBe(200);
    const blocked = await post(app, body, ip);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('content-type')).toContain('application/problem+json');
    expect(blocked.headers.get('retry-after')).toMatch(/^\d+$/);
    expect(blocked.headers.get('ratelimit-remaining')).toBe('0');
    // A different client is unaffected.
    expect((await post(app, body, { 'x-forwarded-for': '198.51.100.1' })).status).toBe(200);
  });

  it('throttles POST /api/auth/* at 20/min but not GET', async () => {
    const app = makeApp();
    for (let i = 0; i < 20; i++) {
      expect((await app.request('/api/auth/sign-in', { method: 'POST' })).status).toBe(200);
    }
    expect((await app.request('/api/auth/sign-in', { method: 'POST' })).status).toBe(429);
    expect((await app.request('/api/auth/get-session')).status).toBe(200);
  });

  it('rejects an oversized body with 413 problem+json before parsing it', async () => {
    const res = await makeApp().request('/v1/recommendations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pad: 'x'.repeat(64 * 1024) }),
    });
    expect(res.status).toBe(413);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
  });
});
