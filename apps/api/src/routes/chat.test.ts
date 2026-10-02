import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { createAiGateway } from '../ai/gateway.ts';
import type { ModelRegistry } from '../ai/providers.ts';
import { createMemoryAiStore } from '../ai/store.ts';
import { createApp } from '../app.ts';
import { silentLogger } from '../lib/logger.ts';
import { createMemoryRateLimitStore } from '../middleware/rate-limit.ts';
import { createBundledCatalogService } from '../services/catalog.ts';
import type { UserDataService } from '../services/user-data.ts';
import { fakeAuth } from '../testing.ts';
import { abortedUsage } from './ai.ts';

const catalog = createBundledCatalogService();

const usage = (input: number, output: number) => ({
  inputTokens: { total: input, noCache: input, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: output, text: output, reasoning: undefined },
});

/**
 * First step calls `what_can_i_make`, the second answers with text that names a brand. The route fetches each
 * step whole (simulated streaming), so the mock answers `doGenerate`.
 */
function chatModel() {
  let step = 0;
  return new MockLanguageModelV4({
    doGenerate: async () => {
      step++;
      if (step % 2 === 1) {
        return {
          content: [
            { type: 'tool-call', toolCallId: `c${step}`, toolName: 'what_can_i_make', input: '{}' },
          ],
          finishReason: { unified: 'tool-calls', raw: undefined },
          usage: usage(100, 10),
          warnings: [],
        };
      }
      return {
        content: [{ type: 'text', text: 'A Gin & Tonic is ready; add Campari for a twist.' }],
        finishReason: { unified: 'stop', raw: undefined },
        usage: usage(200, 20),
        warnings: [],
      };
    },
  });
}

const userData: UserDataService = {
  applyChanges: async () => {
    throw new Error('not used');
  },
  snapshot: async () => ({ bar: ['gin', 'tonic-water', 'lime'], favorites: [], history: [] }),
};

function makeApp(opts: { limit?: number } = {}) {
  const model = chatModel();
  const registry: ModelRegistry = {
    get: (p) =>
      p === 'yandex'
        ? { provider: 'yandex', name: 'yandex/test', model, price: { input: 1, output: 2 } }
        : undefined,
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
    userData,
    rateLimitStore: createMemoryRateLimitStore({ cleanupIntervalMs: 0 }),
    auth: fakeAuth(),
    ping: async () => {},
    logger: silentLogger,
    ai: { gateway, countryOf: () => undefined },
  });
  return { app, store, model };
}

const question = {
  messages: [{ role: 'user', text: 'What can I make right now?' }],
  locale: 'en',
  clientTime: '2026-10-02T19:00:00+03:00',
};

function ask(app: ReturnType<typeof makeApp>['app'], payload: unknown, user: string | null = 'u1') {
  return app.request('/v1/ai/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': user } : {}) },
    body: JSON.stringify(payload),
  });
}

describe('POST /v1/ai/chat', () => {
  it('streams tool results and a brand-free answer, then settles the quota lease', async () => {
    const { app, store } = makeApp();
    const res = await ask(app, question);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-AI-Quota-Remaining')).toBe('4');
    expect(res.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');
    const body = await res.text();
    expect(body).toContain('"toolName":"what_can_i_make"');
    expect(body).toContain('"id":"gin-and-tonic"');
    expect(body).not.toMatch(/campari/i);
    expect(body).toContain('red bitter aperitif');

    const day = new Date().toISOString().slice(0, 10);
    expect(store.usage.get(`u1:${day}`)).toEqual({ requests: 1, input: 300, output: 30 });
    const month = `${day.slice(0, 7)}-01`;
    // 300*1 + 30*2: the reservation is released and only real usage stays.
    expect(store.spend.get(`yandex:${month}`)).toEqual({ reserved: 0, spent: 360 });
  });

  it('answers with JSON for clients that cannot stream', async () => {
    const { app, store } = makeApp();
    const res = await app.request('/v1/ai/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-test-user': 'u1',
      },
      body: JSON.stringify(question),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('X-AI-Quota-Remaining')).toBe('4');
    const body = (await res.json()) as {
      text: string;
      tools: { tool: string; recipes: { id: string }[] }[];
    };
    expect(body.text).toBe('A Gin & Tonic is ready; add red bitter aperitif for a twist.');
    expect(body.tools[0]?.tool).toBe('what_can_i_make');
    expect(body.tools[0]?.recipes.map((r) => r.id)).toContain('gin-and-tonic');
    const day = new Date().toISOString().slice(0, 10);
    expect(store.usage.get(`u1:${day}`)).toMatchObject({ requests: 1, input: 300, output: 30 });
  });

  it('requires a session', async () => {
    const { app, model } = makeApp();
    expect((await ask(app, question, null)).status).toBe(401);
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it('rejects a conversation that does not end with a short user question', async () => {
    const { app, model } = makeApp();
    const last = { role: 'assistant', text: 'Hi' };
    expect((await ask(app, { ...question, messages: [...question.messages, last] })).status).toBe(
      400,
    );
    const long = { role: 'user', text: 'x'.repeat(501) };
    expect((await ask(app, { ...question, messages: [long] })).status).toBe(400);
    expect((await ask(app, { ...question, clientTime: 'tonight' })).status).toBe(400);
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it('answers 429 with a zero quota header when the daily limit is used up', async () => {
    const { app } = makeApp({ limit: 1 });
    const first = await ask(app, question);
    expect(first.status).toBe(200);
    // Until the first answer has streamed, a second question is refused as busy.
    expect((await ask(app, question)).status).toBe(409);
    await first.text();
    const res = await ask(app, question);
    expect(res.status).toBe(429);
    expect(res.headers.get('X-AI-Quota-Remaining')).toBe('0');
    expect(res.headers.get('content-type')).toContain('application/problem+json');
  });

  it('lets only one of two parallel questions through', async () => {
    const { app } = makeApp();
    const [a, b] = await Promise.all([ask(app, question), ask(app, question)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    await (a.status === 200 ? a : b).text();
    // The lock is released once the answer has streamed.
    const next = await ask(app, question);
    expect(next.status).toBe(200);
    await next.text();
  });
});

describe('abortedUsage', () => {
  const step = (input: number, output: number) =>
    ({ usage: { inputTokens: input, outputTokens: output } }) as never;

  it('charges at least the reservation, more when finished steps used more', () => {
    const reserved = { inputTokens: 1000, maxOutputTokens: 100 };
    expect(abortedUsage([], reserved)).toEqual({ inputTokens: 1000, outputTokens: 100 });
    expect(abortedUsage([step(800, 50), step(900, 80)], reserved)).toEqual({
      inputTokens: 1700,
      outputTokens: 130,
    });
  });
});
