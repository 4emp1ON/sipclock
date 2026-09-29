import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { silentLogger } from './lib/logger.ts';

function makeApp(ping: () => Promise<void> = async () => {}) {
  return createApp({
    env: { CORS_ORIGINS: ['http://localhost:3000'], NODE_ENV: 'test' },
    auth: { handler: async () => new Response('auth-ok') },
    ping,
    logger: silentLogger,
  });
}

describe('system routes', () => {
  it('GET /health returns ok without touching the db', async () => {
    const app = makeApp(async () => {
      throw new Error('db must not be called');
    });
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('GET /ready returns 200 when ping succeeds', async () => {
    const res = await makeApp().request('/ready');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ready' });
  });

  it('GET /ready returns 503 problem+json when ping fails', async () => {
    const app = makeApp(async () => {
      throw new Error('boom');
    });
    const res = await app.request('/ready', { headers: { 'X-Request-Id': 'req-1' } });
    expect(res.status).toBe(503);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      instance: '/ready',
      requestId: 'req-1',
    });
  });

  it('GET /v1/meta returns the expected shape', async () => {
    const res = await makeApp().request('/v1/meta');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.apiVersion).toBe('1');
    expect(body.catalogVersion).toBeNull();
    expect(new Date(String(body.time)).toISOString()).toBe(body.time);
  });
});

describe('cross-cutting', () => {
  it('unknown route yields 404 problem+json', async () => {
    const res = await makeApp().request('/nope');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({ status: 404, title: 'Not Found', instance: '/nope' });
  });

  it('echoes a provided X-Request-Id', async () => {
    const res = await makeApp().request('/health', { headers: { 'X-Request-Id': 'abc-123' } });
    expect(res.headers.get('x-request-id')).toBe('abc-123');
  });

  it('generates X-Request-Id when absent', async () => {
    const res = await makeApp().request('/health');
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sets secure headers and CORS for allowed origins', async () => {
    const res = await makeApp().request('/health', {
      headers: { Origin: 'http://localhost:3000' },
    });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });

  it('delegates /api/auth/* to the auth handler', async () => {
    const res = await makeApp().request('/api/auth/ok');
    expect(await res.text()).toBe('auth-ok');
  });

  it('unhandled errors become 500 problem+json without leaking details', async () => {
    const app = makeApp();
    app.get('/boom', () => {
      throw new Error('secret internals');
    });
    const res = await app.request('/boom');
    expect(res.status).toBe(500);
    const body = (await res.json()) as { detail?: string };
    expect(body.detail).toBeUndefined();
  });
});

describe('openapi', () => {
  it('/openapi.json documents the routes', async () => {
    const res = await makeApp().request('/openapi.json');
    expect(res.status).toBe(200);
    const doc = (await res.json()) as { openapi: string; info: { title: string }; paths: object };
    expect(doc.openapi).toMatch(/^3\.1/);
    expect(doc.info.title).toBe('Sipclock API');
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(['/health', '/ready', '/v1/meta']),
    );
  });

  it('/docs serves the Scalar UI', async () => {
    const res = await makeApp().request('/docs');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });
});
