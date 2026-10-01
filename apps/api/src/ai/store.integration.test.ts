import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb } from '../db/client.ts';
import { aiCache, aiProfile, aiSpendMonthly, aiUsageDaily } from '../db/schema/ai.ts';
import { user } from '../db/schema/auth.ts';
import { createAiStore } from './store.ts';

describe.skipIf(!process.env.DATABASE_URL)('AI store (integration)', () => {
  const handle = createDb(process.env.DATABASE_URL ?? '');
  const { db } = handle;
  const store = createAiStore(db);
  const users: string[] = [];
  const cacheKeys: string[] = [];
  // Months in a far-away random year, so spend rows never collide with real data or a crashed run.
  const months: string[] = [];
  const newMonth = () => {
    const month = `${3000 + Math.floor(Math.random() * 6000)}-01-01`;
    months.push(month);
    return month;
  };

  async function newUser() {
    const id = `test-${randomUUID()}`;
    await db.insert(user).values({ id, name: 'Test', email: `${id}@example.test` });
    users.push(id);
    return id;
  }

  async function spendRow(provider: 'yandex' | 'anthropic', month: string) {
    const [row] = await db
      .select()
      .from(aiSpendMonthly)
      .where(and(eq(aiSpendMonthly.provider, provider), eq(aiSpendMonthly.month, month)));
    return row;
  }

  afterAll(async () => {
    if (users.length > 0) await db.delete(user).where(inArray(user.id, users));
    if (cacheKeys.length > 0) await db.delete(aiCache).where(inArray(aiCache.key, cacheKeys));
    if (months.length > 0)
      await db.delete(aiSpendMonthly).where(inArray(aiSpendMonthly.month, months));
    await handle.close();
  });

  it('reserveRequest is atomic: 20 concurrent reservations with limit 5 give exactly 5', async () => {
    const u = await newUser();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => store.reserveRequest(u, '2099-01-01', 5)),
    );
    const granted = results.filter((r) => r !== null);
    expect(granted).toHaveLength(5);
    expect(granted.sort()).toEqual([0, 1, 2, 3, 4]);
    expect(await store.reserveRequest(u, '2099-01-01', 5)).toBeNull();
  });

  it('reserveRequest counts down and refuses a zero limit', async () => {
    const u = await newUser();
    expect(await store.reserveRequest(u, '2099-01-02', 0)).toBeNull();
    expect(await store.reserveRequest(u, '2099-01-02', 2)).toBe(1);
    expect(await store.reserveRequest(u, '2099-01-02', 2)).toBe(0);
    expect(await store.reserveRequest(u, '2099-01-02', 2)).toBeNull();
    // Another day has its own quota.
    expect(await store.reserveRequest(u, '2099-01-03', 2)).toBe(1);
  });

  it('releaseRequest gives a request back and never goes below zero', async () => {
    const u = await newUser();
    expect(await store.reserveRequest(u, '2099-01-04', 1)).toBe(0);
    expect(await store.reserveRequest(u, '2099-01-04', 1)).toBeNull();
    await store.releaseRequest(u, '2099-01-04');
    expect(await store.reserveRequest(u, '2099-01-04', 1)).toBe(0);
    await store.releaseRequest(u, '2099-01-04');
    await store.releaseRequest(u, '2099-01-04');
    expect(await store.reserveRequest(u, '2099-01-04', 3)).toBe(2);
  });

  it('addTokens accumulates on the day row', async () => {
    const u = await newUser();
    await store.reserveRequest(u, '2099-01-05', 5);
    await store.addTokens(u, '2099-01-05', 10, 20);
    await store.addTokens(u, '2099-01-05', 1, 2);
    const [row] = await db.select().from(aiUsageDaily).where(eq(aiUsageDaily.userId, u));
    expect(row).toMatchObject({ requests: 1, inputTokens: 11, outputTokens: 22 });
  });

  it('reserveSpend refuses past the budget', async () => {
    const month = newMonth();
    expect(await store.reserveSpend('yandex', month, 600, 1000)).toBe(true);
    expect(await store.reserveSpend('yandex', month, 500, 1000)).toBe(false);
    expect(await store.reserveSpend('yandex', month, 400, 1000)).toBe(true);
    expect(await store.reserveSpend('yandex', month, 1, 1000)).toBe(false);
    // A single reservation above the budget is refused on a fresh month too.
    const other = newMonth();
    expect(await store.reserveSpend('anthropic', other, 1001, 1000)).toBe(false);
  });

  it('concurrent spend reservations never exceed the budget', async () => {
    const month = newMonth();
    const results = await Promise.all(
      Array.from({ length: 30 }, () => store.reserveSpend('anthropic', month, 100, 1000)),
    );
    expect(results.filter(Boolean)).toHaveLength(10);
    const row = await spendRow('anthropic', month);
    expect(row?.reservedMicros).toBe(1000);
  });

  it('settleSpend replaces the reservation with the actual cost', async () => {
    const month = newMonth();
    expect(await store.reserveSpend('yandex', month, 500, 10_000)).toBe(true);
    await store.settleSpend('yandex', month, 500, 120);
    const row = await spendRow('yandex', month);
    expect(row?.reservedMicros).toBe(0);
    expect(row?.spentMicros).toBe(120);
    // Spent counts against the budget.
    expect(await store.reserveSpend('yandex', month, 9_881, 10_000)).toBe(false);
    expect(await store.reserveSpend('yandex', month, 9_880, 10_000)).toBe(true);
  });

  it('profile defaults to free and unpinned; pin is idempotent', async () => {
    const u = await newUser();
    expect(await store.profile(u)).toEqual({ plan: 'free', pinned: false });
    await store.pin(u);
    expect(await store.profile(u)).toEqual({ plan: 'free', pinned: true });
    const [first] = await db.select().from(aiProfile).where(eq(aiProfile.userId, u));
    await store.pin(u);
    const [second] = await db.select().from(aiProfile).where(eq(aiProfile.userId, u));
    expect(second?.ruPinnedAt).toEqual(first?.ruPinnedAt);
    expect((await store.profile(u)).pinned).toBe(true);
  });

  it('cache returns a stored value, honours the max age and overwrites on put', async () => {
    const key = `test-${randomUUID()}`;
    cacheKeys.push(key);
    expect(await store.cacheGet(key, 60_000)).toBeUndefined();
    await store.cachePut(key, { a: 1 });
    expect(await store.cacheGet(key, 60_000)).toEqual({ a: 1 });
    await db
      .update(aiCache)
      .set({ createdAt: new Date(Date.now() - 2 * 60_000) })
      .where(eq(aiCache.key, key));
    expect(await store.cacheGet(key, 60_000)).toBeUndefined();
    expect(await store.cacheGet(key, 10 * 60_000)).toEqual({ a: 1 });
    await store.cachePut(key, { a: 2 });
    expect(await store.cacheGet(key, 60_000)).toEqual({ a: 2 });
  });
});
