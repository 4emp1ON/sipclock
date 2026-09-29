import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { silentLogger } from './lib/logger.ts';
import { createMemoryRateLimitStore } from './middleware/rate-limit.ts';
import { createBundledCatalogService } from './services/catalog.ts';

const catalog = createBundledCatalogService();

function makeApp() {
  return createApp({
    env: {
      CORS_ORIGINS: [],
      NODE_ENV: 'test',
      TRUST_PROXY_HOPS: 0,
      RATE_LIMIT_RECOMMEND_PER_MIN: 60,
    },
    catalog,
    rateLimitStore: createMemoryRateLimitStore({ cleanupIntervalMs: 0 }),
    auth: { handler: async () => new Response('ok') },
    ping: async () => {},
    logger: silentLogger,
  });
}

describe('catalog', () => {
  it('GET /v1/catalog/manifest returns the manifest', async () => {
    const res = await makeApp().request('/v1/catalog/manifest');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual(catalog.manifest);
    expect(body.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('GET /v1/catalog serves the bundle with a strong ETag and cache headers', async () => {
    const res = await makeApp().request('/v1/catalog');
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBe(`"${catalog.manifest.sha256}"`);
    expect(res.headers.get('cache-control')).toBe(
      'public, max-age=300, stale-while-revalidate=86400',
    );
    expect(await res.text()).toBe(catalog.bundleJson);
  });

  it('returns 304 without a body when If-None-Match matches', async () => {
    const app = makeApp();
    const etag = (await app.request('/v1/catalog')).headers.get('etag') ?? '';
    const res = await app.request('/v1/catalog', { headers: { 'If-None-Match': etag } });
    expect(res.status).toBe(304);
    expect(await res.text()).toBe('');
    expect(res.headers.get('etag')).toBe(etag);
  });

  it('returns 200 when If-None-Match does not match', async () => {
    const res = await makeApp().request('/v1/catalog', { headers: { 'If-None-Match': '"other"' } });
    expect(res.status).toBe(200);
  });

  it('compresses the bundle when the client accepts gzip', async () => {
    const res = await makeApp().request('/v1/catalog', { headers: { 'Accept-Encoding': 'gzip' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-encoding')).toBe('gzip');
    const json = await new Response(res.body?.pipeThrough(new DecompressionStream('gzip'))).text();
    expect(json).toBe(catalog.bundleJson);
  });

  it('documents the catalog paths in OpenAPI', async () => {
    const res = await makeApp().request('/openapi.json');
    const doc = (await res.json()) as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(['/v1/catalog', '/v1/catalog/manifest', '/v1/recommendations']),
    );
  });
});
