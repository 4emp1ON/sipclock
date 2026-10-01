import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { silentLogger } from '../lib/logger.ts';
import { type AiCaller, type CallResult, createAiGateway } from './gateway.ts';
import type { ModelHandle, ModelRegistry } from './providers.ts';
import type { Provider } from './region.ts';
import { createMemoryAiStore } from './store.ts';

const NOW = new Date('2026-10-01T12:00:00Z');
const DAY = '2026-10-01';
const MONTH = '2026-10-01';
const price = { input: 1, output: 2 };
const estimate = { inputTokens: 100, maxOutputTokens: 50 }; // reserves 200

const handle = (provider: Provider): ModelHandle => ({
  provider,
  name: `${provider}/test`,
  model: new MockLanguageModelV4(),
  price,
});

function setup(
  opts: {
    providers?: Provider[];
    budgets?: Partial<Record<Provider, number>>;
    limit?: number;
  } = {},
) {
  const handles = new Map((opts.providers ?? ['anthropic', 'yandex']).map((p) => [p, handle(p)]));
  const registry: ModelRegistry = {
    get: (p) => handles.get(p),
    budgets: { yandex: 1_000_000, anthropic: 1_000_000, ...opts.budgets },
  };
  const store = createMemoryAiStore();
  const gateway = createAiGateway({
    registry,
    store,
    logger: silentLogger,
    dailyLimits: { free: opts.limit ?? 3 },
    now: () => NOW,
  });
  return { gateway, store };
}

const caller = (over: Partial<AiCaller> = {}): AiCaller => ({
  userId: 'u1',
  country: 'US',
  locale: 'en',
  requestId: 'r1',
  ...over,
});

const ok = (value = 'x', inputTokens = 10, outputTokens = 20): CallResult<string> => ({
  value,
  usage: { inputTokens, outputTokens },
});

describe('createAiGateway', () => {
  it('reports enabled only when a provider is configured', () => {
    expect(setup().gateway.enabled).toBe(true);
    expect(setup({ providers: [] }).gateway.enabled).toBe(false);
  });

  it('runs on Claude for a foreign user, counts down the quota and settles the spend', async () => {
    const { gateway, store } = setup();
    const used: string[] = [];
    const call = async (m: ModelHandle) => {
      used.push(m.name);
      return ok();
    };
    const first = await gateway.run(caller(), 'f', estimate, call);
    expect(first).toEqual({ ok: true, value: 'x', model: 'anthropic/test', remaining: 2 });
    const second = await gateway.run(caller(), 'f', estimate, call);
    expect(second).toMatchObject({ ok: true, remaining: 1 });
    expect(used).toEqual(['anthropic/test', 'anthropic/test']);
    expect(store.usage.get(`u1:${DAY}`)).toEqual({ requests: 2, input: 20, output: 40 });
    // cost = 10*1 + 20*2 = 50 per call; the 200 reservation returns to 0.
    expect(store.spend.get(`anthropic:${MONTH}`)).toEqual({ reserved: 0, spent: 100 });
  });

  it('refuses when the quota is exhausted and does not call the model', async () => {
    const { gateway, store } = setup({ limit: 1 });
    let calls = 0;
    const call = async () => {
      calls++;
      return ok();
    };
    await gateway.run(caller(), 'f', estimate, call);
    const out = await gateway.run(caller(), 'f', estimate, call);
    expect(out).toEqual({ ok: false, reason: 'quota', remaining: 0 });
    expect(calls).toBe(1);
    expect(store.usage.get(`u1:${DAY}`)?.requests).toBe(1);
  });

  it('falls back from Claude to Yandex and counts one request', async () => {
    const { gateway, store } = setup();
    const tried: string[] = [];
    const out = await gateway.run(caller(), 'f', estimate, async (m) => {
      tried.push(m.provider);
      if (m.provider === 'anthropic') throw new Error('outage');
      return ok('from-yandex');
    });
    expect(tried).toEqual(['anthropic', 'yandex']);
    expect(out).toEqual({ ok: true, value: 'from-yandex', model: 'yandex/test', remaining: 2 });
    expect(store.usage.get(`u1:${DAY}`)?.requests).toBe(1);
    // The failed attempt reported no usage, so it is charged its whole reservation.
    expect(store.spend.get(`anthropic:${MONTH}`)).toEqual({ reserved: 0, spent: 200 });
    expect(store.spend.get(`yandex:${MONTH}`)).toEqual({ reserved: 0, spent: 50 });
  });

  it('never calls Anthropic for a pinned user, even from a non-RU country', async () => {
    const { gateway, store } = setup();
    await store.pin('u1');
    const tried: string[] = [];
    const out = await gateway.run(caller({ country: 'DE' }), 'f', estimate, async (m) => {
      tried.push(m.provider);
      return ok();
    });
    expect(tried).toEqual(['yandex']);
    expect(out).toMatchObject({ ok: true, model: 'yandex/test' });
  });

  it('pins a Russian user on the first request and keeps them on Yandex afterwards', async () => {
    const { gateway, store } = setup();
    await gateway.run(caller({ country: 'RU', locale: 'ru' }), 'f', estimate, async () => ok());
    expect((await store.profile('u1')).pinned).toBe(true);
    const tried: string[] = [];
    await gateway.run(caller({ country: 'US', locale: 'en' }), 'f', estimate, async (m) => {
      tried.push(m.provider);
      return ok();
    });
    expect(tried).toEqual(['yandex']);
  });

  it('uses Yandex for an unknown country', async () => {
    const { gateway } = setup();
    const out = await gateway.run(caller({ country: undefined }), 'f', estimate, async () => ok());
    expect(out).toMatchObject({ ok: true, model: 'yandex/test' });
  });

  it('skips Anthropic when its budget cannot cover the reservation', async () => {
    const { gateway, store } = setup({ budgets: { anthropic: 100 } }); // needs 200
    const tried: string[] = [];
    const out = await gateway.run(caller(), 'f', estimate, async (m) => {
      tried.push(m.provider);
      return ok();
    });
    expect(tried).toEqual(['yandex']);
    expect(out).toMatchObject({ ok: true, model: 'yandex/test', remaining: 2 });
    expect(store.spend.get(`anthropic:${MONTH}`)).toEqual({ reserved: 0, spent: 0 });
  });

  it('returns unavailable but keeps the request counted when every called provider fails', async () => {
    const { gateway, store } = setup();
    const before = (await gateway.run(caller(), 'f', estimate, async () => ok())) as {
      remaining: number;
    };
    const usageBefore = store.usage.get(`u1:${DAY}`)?.requests ?? 0;
    const out = await gateway.run(caller(), 'f', estimate, async () => {
      throw new Error('down');
    });
    // A failed call may have been billed, so retrying must not be free.
    expect(out).toEqual({ ok: false, reason: 'unavailable', remaining: before.remaining - 1 });
    expect(store.usage.get(`u1:${DAY}`)?.requests).toBe(usageBefore + 1);
    expect(store.spend.get(`anthropic:${MONTH}`)?.reserved).toBe(0);
    expect(store.spend.get(`yandex:${MONTH}`)?.reserved).toBe(0);
  });

  it('returns unavailable when every budget is exhausted, releasing the request', async () => {
    const { gateway, store } = setup({ budgets: { anthropic: 1, yandex: 1 } });
    const out = await gateway.run(caller(), 'f', estimate, async () => ok());
    expect(out).toMatchObject({ ok: false, reason: 'unavailable' });
    expect(store.usage.get(`u1:${DAY}`)?.requests).toBe(0);
  });

  it('returns unavailable without touching the quota when no provider is configured', async () => {
    const { gateway, store } = setup({ providers: [] });
    const out = await gateway.run(caller(), 'f', estimate, async () => ok());
    expect(out).toEqual({ ok: false, reason: 'unavailable', remaining: null });
    expect(store.usage.size).toBe(0);
  });

  it('only Anthropic configured: a Russian user gets unavailable without quota use', async () => {
    const { gateway, store } = setup({ providers: ['anthropic'] });
    const out = await gateway.run(caller({ country: 'RU' }), 'f', estimate, async () => ok());
    expect(out).toEqual({ ok: false, reason: 'unavailable', remaining: null });
    expect(store.usage.size).toBe(0);
  });

  describe('open (streamed calls)', () => {
    it('reserves a request and budget, then settles what the stream reported, once', async () => {
      const { gateway, store } = setup({ providers: ['yandex'] });
      const out = await gateway.open(caller({ country: 'RU', locale: 'ru' }), 'chat', estimate);
      if (!out.ok) throw new Error('expected a lease');
      expect(out.lease).toMatchObject({ model: { name: 'yandex/test' }, remaining: 2 });
      expect(store.spend.get(`yandex:${MONTH}`)).toEqual({ reserved: 200, spent: 0 });

      await out.lease.settle({ inputTokens: 10, outputTokens: 20 });
      await out.lease.settle({ inputTokens: 1000, outputTokens: 1000 });
      expect(store.spend.get(`yandex:${MONTH}`)).toEqual({ reserved: 0, spent: 50 });
      expect(store.usage.get(`u1:${DAY}`)).toEqual({ requests: 1, input: 10, output: 20 });
    });

    it('charges the whole reservation when the stream reported no usage', async () => {
      const { gateway, store } = setup({ providers: ['yandex'] });
      const out = await gateway.open(caller(), 'chat', estimate);
      if (!out.ok) throw new Error('expected a lease');
      await out.lease.settle(undefined, new Error('stream broke'));
      expect(store.spend.get(`yandex:${MONTH}`)).toEqual({ reserved: 0, spent: 200 });
    });

    it('refuses over the daily quota', async () => {
      const { gateway } = setup({ limit: 1 });
      expect((await gateway.open(caller(), 'chat', estimate)).ok).toBe(true);
      expect(await gateway.open(caller(), 'chat', estimate)).toEqual({
        ok: false,
        reason: 'quota',
        remaining: 0,
      });
    });

    it('moves to the next provider when a budget is spent, and returns the request when none fits', async () => {
      const { gateway } = setup({ budgets: { anthropic: 100 } });
      const out = await gateway.open(caller(), 'chat', estimate);
      expect(out.ok && out.lease.model.name).toBe('yandex/test');

      const none = setup({ budgets: { anthropic: 100, yandex: 100 } });
      expect(await none.gateway.open(caller(), 'chat', estimate)).toEqual({
        ok: false,
        reason: 'unavailable',
        remaining: 3,
      });
      expect(none.store.usage.get(`u1:${DAY}`)?.requests ?? 0).toBe(0);
    });
  });
});
