import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { createAiGateway } from '../ai/gateway.ts';
import type { ModelRegistry } from '../ai/providers.ts';
import { createMemoryAiStore } from '../ai/store.ts';
import { createApp } from '../app.ts';
import { silentLogger } from '../lib/logger.ts';
import { createMemoryRateLimitStore } from '../middleware/rate-limit.ts';
import { createBundledCatalogService } from '../services/catalog.ts';
import { fakeAuth, unusedUserData } from '../testing.ts';

const catalog = createBundledCatalogService();

function model() {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            suggestions: [
              { ingredientId: 'vodka', fit: 'workable', note: 'Cleaner, less botanical' },
            ],
            canSkip: false,
          }),
        },
      ],
      finishReason: { unified: 'stop', raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 20, text: 20, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

function makeApp(opts: { withModel?: boolean; limit?: number; country?: string } = {}) {
  const m = model();
  const registry: ModelRegistry = {
    get: (p) =>
      opts.withModel === false || p !== 'yandex'
        ? undefined
        : { provider: 'yandex', name: 'yandex/test', model: m, price: { input: 1, output: 2 } },
    budgets: { yandex: 1_000_000_000, anthropic: 0 },
  };
  const store = createMemoryAiStore();
  const gateway = createAiGateway({
    registry,
    store,
    logger: silentLogger,
    dailyLimits: { free: opts.limit ?? 5 },
  });
  const app = createApp({
    env: {
      CORS_ORIGINS: ['http://localhost:3000'],
      NODE_ENV: 'test',
      TRUST_PROXY_HOPS: 0,
      RATE_LIMIT_RECOMMEND_PER_MIN: 60,
    },
    catalog,
    userData: unusedUserData,
    rateLimitStore: createMemoryRateLimitStore({ cleanupIntervalMs: 0 }),
    auth: fakeAuth(),
    ping: async () => {},
    logger: silentLogger,
    ai: { gateway, countryOf: () => opts.country },
  });
  return { app, model: m, store };
}

const body = { recipeId: 'negroni', ingredientId: 'gin', bar: ['vodka'], locale: 'en' };

function post(
  app: ReturnType<typeof makeApp>['app'],
  payload: unknown,
  headers: Record<string, string> = { 'x-test-user': 'u1' },
) {
  return app.request('/v1/ai/substitutes', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });
}

describe('POST /v1/ai/substitutes', () => {
  it('is not mounted without deps.ai', async () => {
    const { app } = makeApp();
    const bare = createApp({
      env: {
        CORS_ORIGINS: [],
        NODE_ENV: 'test',
        TRUST_PROXY_HOPS: 0,
        RATE_LIMIT_RECOMMEND_PER_MIN: 60,
      },
      catalog,
      userData: unusedUserData,
      rateLimitStore: createMemoryRateLimitStore({ cleanupIntervalMs: 0 }),
      auth: fakeAuth(),
      ping: async () => {},
      logger: silentLogger,
    });
    expect((await post(bare, body)).status).toBe(404);
    expect((await post(app, body)).status).toBe(200);
  });

  it('requires a session', async () => {
    const { app, model: m } = makeApp();
    const res = await post(app, body, {});
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect(m.doGenerateCalls).toHaveLength(0);
  });

  it('404 for an unknown recipe', async () => {
    const { app } = makeApp();
    const res = await post(app, { ...body, recipeId: 'no-such-recipe' });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ status: 404 });
  });

  it('400 when the ingredient is not in the recipe', async () => {
    const { app } = makeApp();
    const res = await post(app, { ...body, ingredientId: 'tequila' });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ status: 400 });
  });

  it('400 for an invalid body and 413 past the body limit', async () => {
    const { app } = makeApp();
    expect((await post(app, { ...body, locale: 'fr' })).status).toBe(400);
    expect((await post(app, { ...body, bar: ['x'.repeat(20_000)] })).status).toBe(413);
  });

  it('200 with source ai and the quota header, then serves the repeat from the cache', async () => {
    const { app, model: m } = makeApp({ country: 'DE' });
    const first = await post(app, body);
    expect(first.status).toBe(200);
    expect(first.headers.get('X-AI-Quota-Remaining')).toBe('4');
    expect(first.headers.get('cache-control')).toBe('no-store');
    expect(await first.json()).toEqual({
      recipeId: 'negroni',
      ingredientId: 'gin',
      source: 'ai',
      suggestions: [
        { ingredientId: 'vodka', inBar: true, fit: 'workable', note: 'Cleaner, less botanical' },
      ],
      canSkip: false,
    });

    const second = await post(app, body);
    expect(second.status).toBe(200);
    expect(second.headers.get('X-AI-Quota-Remaining')).toBeNull();
    expect(await second.json()).toMatchObject({ source: 'ai' });
    expect(m.doGenerateCalls).toHaveLength(1);
  });

  it('falls back to the catalog when the quota is exhausted', async () => {
    const { app, model: m } = makeApp({ limit: 0 });
    const res = await post(app, body);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      source: 'catalog',
      suggestions: [{ ingredientId: 'vodka', note: 'Less botanical, still works' }],
    });
    expect(m.doGenerateCalls).toHaveLength(0);
  });

  it('falls back to the catalog when no provider is configured', async () => {
    const { app } = makeApp({ withModel: false });
    const res = await post(app, body);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-AI-Quota-Remaining')).toBeNull();
    expect(await res.json()).toMatchObject({ source: 'catalog' });
  });

  it('pins the account when the browser asks for Russian even if the UI is English', async () => {
    const { app, store } = makeApp({ country: 'DE' });
    const res = await post(app, body, { 'x-test-user': 'u1', 'accept-language': 'ru-RU,ru;q=0.9' });
    expect(res.status).toBe(200);
    expect(await store.profile('u1')).toMatchObject({ pinned: true });
  });
});
