import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { silentLogger } from '../lib/logger.ts';
import { createMemoryRateLimitStore } from '../middleware/rate-limit.ts';
import { createBundledCatalogService } from '../services/catalog.ts';
import { fakeAuth, unusedUserData } from '../testing.ts';

const app = createApp({
  env: {
    CORS_ORIGINS: [],
    NODE_ENV: 'test',
    TRUST_PROXY_HOPS: 0,
    RATE_LIMIT_RECOMMEND_PER_MIN: 60,
  },
  catalog: createBundledCatalogService(),
  userData: unusedUserData,
  rateLimitStore: createMemoryRateLimitStore({ cleanupIntervalMs: 0 }),
  auth: fakeAuth(),
  ping: async () => {},
  logger: silentLogger,
});

describe('GET /v1/search', () => {
  it('finds recipes without a session, lexically when no provider is configured', async () => {
    const res = await app.request(
      '/v1/search?q=%D0%BD%D0%B5%D0%B3%D1%80%D0%BE%D0%BD%D0%B8&locale=ru&limit=3',
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('max-age');
    const body = (await res.json()) as {
      query: string;
      semantic: boolean;
      results: { id: string }[];
    };
    expect(body).toMatchObject({ query: 'негрони', semantic: false });
    expect(body.results[0]?.id).toBe('negroni');
    expect(body.results.length).toBeLessThanOrEqual(3);
  });

  it('rejects an empty or overlong query', async () => {
    expect((await app.request('/v1/search?q=')).status).toBe(400);
    expect((await app.request(`/v1/search?q=${'x'.repeat(101)}`)).status).toBe(400);
    expect((await app.request('/v1/search?q=gin&limit=100')).status).toBe(400);
  });

  it('limits HEAD like GET: both run the search', async () => {
    let last = 0;
    for (let i = 0; i < 61; i++) {
      last = (await app.request(`/v1/search?q=gin${i}`, { method: 'HEAD' })).status;
    }
    expect(last).toBe(429);
  });
});
