import type { ChangeBatch } from '@sipclock/domain';
import { describe, expect, it } from 'vitest';
import { createApp, MAX_CHANGES_BODY_BYTES, ME_RATE_LIMIT_PER_MIN } from './app.ts';
import { silentLogger } from './lib/logger.ts';
import { createMemoryRateLimitStore } from './middleware/rate-limit.ts';
import { createBundledCatalogService } from './services/catalog.ts';
import type { UserDataService } from './services/user-data.ts';
import { fakeAuth } from './testing.ts';

const catalog = createBundledCatalogService();

function makeApp() {
  const calls: { userId: string; key: string; batch: ChangeBatch }[] = [];
  const userData: UserDataService = {
    applyChanges: async (userId, key, batch) => {
      calls.push({ userId, key, batch });
      return { applied: batch.ops.length, skipped: 0 };
    },
    snapshot: async () => ({ bar: ['gin'], favorites: [], history: [] }),
  };
  const app = createApp({
    env: {
      CORS_ORIGINS: ['http://localhost:3000'],
      NODE_ENV: 'test',
      TRUST_PROXY_HOPS: 0,
      RATE_LIMIT_RECOMMEND_PER_MIN: 60,
    },
    catalog,
    userData,
    rateLimitStore: createMemoryRateLimitStore({ cleanupIntervalMs: 0 }),
    auth: fakeAuth(),
    ping: async () => {},
    logger: silentLogger,
  });
  return { app, calls };
}

const validBatch = {
  ops: [{ table: 'bar_item', op: 'put', id: 'gin', data: { in_bar: true, updated_at: 1 } }],
};

function post(
  app: ReturnType<typeof makeApp>['app'],
  body: unknown,
  headers: Record<string, string> = {},
) {
  return app.request('/v1/me/changes', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-test-user': 'u1',
      'idempotency-key': 'k1',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('/v1/me/*', () => {
  it('requires a session (401 problem+json) before touching the service', async () => {
    const { app, calls } = makeApp();
    const res = await post(app, validBatch, { 'x-test-user': '' });
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({ status: 401, title: 'Unauthorized' });
    expect((await app.request('/v1/me/data')).status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('passes the session user, key and parsed batch to the service', async () => {
    const { app, calls } = makeApp();
    const res = await post(app, validBatch);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ applied: 1, skipped: 0 });
    expect(calls).toEqual([{ userId: 'u1', key: 'k1', batch: validBatch }]);
  });

  it('rejects a missing, empty or oversized Idempotency-Key with 400', async () => {
    const { app, calls } = makeApp();
    const missing = await app.request('/v1/me/changes', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user': 'u1' },
      body: JSON.stringify(validBatch),
    });
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({
      status: 400,
      errors: [expect.objectContaining({ field: 'idempotency-key' })],
    });
    expect((await post(app, validBatch, { 'idempotency-key': '' })).status).toBe(400);
    expect((await post(app, validBatch, { 'idempotency-key': 'k'.repeat(129) })).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('validates the batch against the domain contract', async () => {
    const { app, calls } = makeApp();
    const cases: unknown[] = [
      {},
      { ops: [] },
      { ops: [{ table: 'user', op: 'put', id: 'x' }] },
      { ops: [{ table: 'bar_item', op: 'upsert', id: 'gin' }] },
      { ops: [{ table: 'bar_item', op: 'put', id: 'Gin!' }] },
      { ops: [{ table: 'drink_log', op: 'put', id: 'not-a-uuid' }] },
      { ops: [{ table: 'favorite', op: 'put', id: 'negroni', data: { is_favorite: 'yes' } }] },
      { ops: Array.from({ length: 501 }, () => validBatch.ops[0]) },
    ];
    for (const body of cases) {
      const res = await post(app, body);
      expect(res.status, JSON.stringify(body).slice(0, 80)).toBe(400);
      expect(res.headers.get('content-type')).toContain('application/problem+json');
    }
    expect(calls).toHaveLength(0);
  });

  it('rejects non-JSON bodies, malformed JSON and oversized bodies', async () => {
    const { app } = makeApp();
    expect((await post(app, 'ops=1', { 'content-type': 'text/plain' })).status).toBe(415);
    expect((await post(app, '{"ops":')).status).toBe(400);
    const big = await post(app, { ops: [], pad: 'x'.repeat(MAX_CHANGES_BODY_BYTES) });
    expect(big.status).toBe(413);
  });

  it('accepts a full batch of 500 ops within the body limit', async () => {
    const { app } = makeApp();
    const ops = Array.from({ length: 500 }, () => ({
      table: 'drink_log',
      op: 'put',
      id: crypto.randomUUID(),
      data: { recipe_id: 'smoky-ginger-sour', made_at: 1_790_000_000_000 },
    }));
    const res = await post(app, { ops });
    expect(res.status).toBe(200);
  });

  it('GET /v1/me/data returns the snapshot', async () => {
    const { app } = makeApp();
    const res = await app.request('/v1/me/data', { headers: { 'x-test-user': 'u1' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ bar: ['gin'], favorites: [], history: [] });
  });

  it('rate limits /v1/me/* per client', async () => {
    const { app } = makeApp();
    for (let i = 0; i < ME_RATE_LIMIT_PER_MIN; i++) await app.request('/v1/me/data');
    const res = await app.request('/v1/me/data', { headers: { 'x-test-user': 'u1' } });
    expect(res.status).toBe(429);
  });

  it('allows the Idempotency-Key header in CORS preflight', async () => {
    const { app } = makeApp();
    const res = await app.request('/v1/me/changes', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type, idempotency-key',
      },
    });
    expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain(
      'idempotency-key',
    );
  });

  it('documents both routes in /openapi.json', async () => {
    const { app } = makeApp();
    const doc = (await (await app.request('/openapi.json')).json()) as { paths: object };
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(['/v1/me/changes', '/v1/me/data']),
    );
  });
});
