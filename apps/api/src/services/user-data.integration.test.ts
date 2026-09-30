import { randomUUID } from 'node:crypto';
import type { ChangeOp } from '@sipclock/domain';
import { MAX_CLOCK_SKEW_MS } from '@sipclock/domain';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { createDb } from '../db/client.ts';
import { user } from '../db/schema/auth.ts';
import { barItem, drinkLog, favorite, idempotencyKey } from '../db/schema/user-data.ts';
import { silentLogger } from '../lib/logger.ts';
import { createMemoryRateLimitStore } from '../middleware/rate-limit.ts';
import { fakeAuth } from '../testing.ts';
import { createBundledCatalogService } from './catalog.ts';
import { createUserDataService, IDEMPOTENCY_TTL_MS } from './user-data.ts';

describe.skipIf(!process.env.DATABASE_URL)('user data sync (integration)', () => {
  const handle = createDb(process.env.DATABASE_URL ?? '');
  const { db } = handle;
  const catalog = createBundledCatalogService();
  let serverNow = 1_790_000_000_000;
  const service = createUserDataService(db, catalog, () => serverNow);
  const users: string[] = [];

  async function newUser() {
    const id = `test-${randomUUID()}`;
    await db.insert(user).values({ id, name: 'Test', email: `${id}@example.test` });
    users.push(id);
    return id;
  }

  const apply = (userId: string, ops: ChangeOp[], key: string = randomUUID()) =>
    service.applyChanges(userId, key, { ops });

  const bar = (id: string, inBar: boolean, updatedAt: number): ChangeOp => ({
    table: 'bar_item',
    op: 'put',
    id,
    data: { in_bar: inBar, updated_at: updatedAt },
  });

  async function barRow(userId: string, ingredientId: string) {
    const [row] = await db
      .select()
      .from(barItem)
      .where(and(eq(barItem.userId, userId), eq(barItem.ingredientId, ingredientId)));
    return row;
  }

  beforeEach(() => {
    serverNow = 1_790_000_000_000;
  });

  afterAll(async () => {
    if (users.length > 0) await db.delete(user).where(inArray(user.id, users));
    await handle.close();
  });

  it('last writer wins: newer applies, older loses, a tie keeps the stored row', async () => {
    const u = await newUser();
    expect(await apply(u, [bar('gin', true, 1000)])).toEqual({ applied: 1, skipped: 0 });
    expect(await apply(u, [bar('gin', false, 2000)])).toEqual({ applied: 1, skipped: 0 });
    expect(await apply(u, [bar('gin', true, 1500)])).toEqual({ applied: 0, skipped: 1 });
    expect(await apply(u, [bar('gin', true, 2000)])).toEqual({ applied: 0, skipped: 1 });
    expect(await barRow(u, 'gin')).toMatchObject({ inBar: false, updatedAt: 2000 });

    const favoriteOp = (isFavorite: boolean, updatedAt: number): ChangeOp => ({
      table: 'favorite',
      op: 'patch',
      id: 'negroni',
      data: { is_favorite: isFavorite, updated_at: updatedAt },
    });
    await apply(u, [favoriteOp(true, 10)]);
    expect(await apply(u, [favoriteOp(false, 5)])).toEqual({ applied: 0, skipped: 1 });
    const [fav] = await db.select().from(favorite).where(eq(favorite.userId, u));
    expect(fav).toMatchObject({ recipeId: 'negroni', isFavorite: true, updatedAt: 10 });
  });

  it('clamps client clocks running ahead of the server', async () => {
    const u = await newUser();
    await apply(u, [bar('gin', true, serverNow + MAX_CLOCK_SKEW_MS)]);
    expect((await barRow(u, 'gin'))?.updatedAt).toBe(serverNow + MAX_CLOCK_SKEW_MS);
    await apply(u, [bar('vodka', true, serverNow + MAX_CLOCK_SKEW_MS + 1)]);
    expect((await barRow(u, 'vodka'))?.updatedAt).toBe(serverNow);
    // A clamped far-future write does not win forever: a later write at a normal clock beats it.
    serverNow += 1000;
    expect(await apply(u, [bar('vodka', false, serverNow)])).toEqual({ applied: 1, skipped: 0 });
  });

  it('keeps the client order of clamped edits to one row', async () => {
    const u = await newUser();
    const ahead = serverNow + MAX_CLOCK_SKEW_MS + 60_000;
    // A fast device adds, then removes gin while offline; both clocks get clamped.
    expect(await apply(u, [bar('gin', true, ahead), bar('gin', false, ahead + 5)])).toEqual({
      applied: 2,
      skipped: 0,
    });
    expect((await barRow(u, 'gin'))?.inBar).toBe(false);
  });

  it('delete is a tombstone at the client clock; without a clock it is skipped', async () => {
    const u = await newUser();
    await apply(u, [bar('gin', true, 1000)]);
    const del = (updatedAt: number): ChangeOp => ({
      table: 'bar_item',
      op: 'delete',
      id: 'gin',
      data: { in_bar: true, updated_at: updatedAt },
    });
    // The flag is forced false whatever the payload says; an older delete loses.
    expect(await apply(u, [del(500)])).toEqual({ applied: 0, skipped: 1 });
    expect(await apply(u, [del(2000)])).toEqual({ applied: 1, skipped: 0 });
    expect(await barRow(u, 'gin')).toMatchObject({ inBar: false, updatedAt: 2000 });
    // An offline remove then re-add in one batch keeps the re-add (client order, client clocks).
    expect(await apply(u, [del(3000), bar('gin', true, 3001)])).toEqual({ applied: 2, skipped: 0 });
    expect((await barRow(u, 'gin'))?.inBar).toBe(true);
    // No clock: cannot be ordered against other devices.
    expect(await apply(u, [{ table: 'favorite', op: 'delete', id: 'negroni' }])).toEqual({
      applied: 0,
      skipped: 1,
    });
  });

  it('applies batches that touch rows in any order', async () => {
    const u = await newUser();
    const ids = ['gin', 'vodka', 'rum', 'tequila'];
    const forward = ids.map((id, i) => bar(id, true, 100 + i));
    const backward = ids.toReversed().map((id, i) => bar(id, false, 200 + i));
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        apply(u, i % 2 === 0 ? forward : backward.map((op) => ({ ...op }))),
      ),
    );
    expect(results.every((r) => r.applied + r.skipped === ids.length)).toBe(true);
    for (const id of ids) expect((await barRow(u, id))?.inBar).toBe(false);
  });

  it('replays an idempotency key with the stored response without re-applying', async () => {
    const u = await newUser();
    const key = randomUUID();
    const first = await apply(u, [bar('gin', true, 1000), bar('unknown-thing', true, 1000)], key);
    expect(first).toEqual({ applied: 1, skipped: 1 });
    // Same key, different payload: the stored answer comes back and nothing is written.
    const replay = await apply(u, [bar('gin', false, 5000)], key);
    expect(replay).toEqual(first);
    expect(await barRow(u, 'gin')).toMatchObject({ inBar: true, updatedAt: 1000 });
    // Keys are per user.
    const other = await newUser();
    expect(await apply(other, [bar('gin', true, 1)], key)).toEqual({ applied: 1, skipped: 0 });
  });

  it('answers concurrent requests with the same key once', async () => {
    const u = await newUser();
    const key = randomUUID();
    const id = randomUUID();
    const op: ChangeOp = {
      table: 'drink_log',
      op: 'put',
      id,
      data: { recipe_id: 'negroni', made_at: 1 },
    };
    const results = await Promise.all([apply(u, [op], key), apply(u, [op], key)]);
    expect(results).toEqual([
      { applied: 1, skipped: 0 },
      { applied: 1, skipped: 0 },
    ]);
  });

  it('drops expired idempotency keys', async () => {
    const u = await newUser();
    const key = randomUUID();
    await apply(u, [bar('gin', true, 1)], key);
    await db
      .update(idempotencyKey)
      .set({ createdAt: new Date(serverNow - IDEMPOTENCY_TTL_MS - 1000) })
      .where(eq(idempotencyKey.userId, u));
    expect(await apply(u, [bar('gin', true, 2)], key)).toEqual({ applied: 1, skipped: 0 });
  });

  it("never touches or reveals another user's drink_log entry", async () => {
    const owner = await newUser();
    const intruder = await newUser();
    const id = randomUUID();
    await apply(owner, [
      { table: 'drink_log', op: 'put', id, data: { recipe_id: 'negroni', made_at: 1000 } },
    ]);
    expect(
      await apply(intruder, [
        { table: 'drink_log', op: 'put', id, data: { recipe_id: 'daiquiri', made_at: 2000 } },
        { table: 'drink_log', op: 'delete', id },
      ]),
    ).toEqual({ applied: 0, skipped: 2 });
    const rows = await db.select().from(drinkLog).where(eq(drinkLog.id, id));
    expect(rows).toEqual([expect.objectContaining({ userId: owner, recipeId: 'negroni' })]);
    // The owner can delete it.
    expect(await apply(owner, [{ table: 'drink_log', op: 'delete', id }])).toEqual({
      applied: 1,
      skipped: 0,
    });
  });

  it('skips unknown catalog ids and ops without data', async () => {
    const u = await newUser();
    const result = await apply(u, [
      bar('not-an-ingredient', true, 1),
      {
        table: 'favorite',
        op: 'put',
        id: 'not-a-recipe',
        data: { is_favorite: true, updated_at: 1 },
      },
      { table: 'favorite', op: 'put', id: 'gin', data: { is_favorite: true, updated_at: 1 } },
      {
        table: 'drink_log',
        op: 'put',
        id: randomUUID(),
        data: { recipe_id: 'not-a-recipe', made_at: 1 },
      },
      { table: 'bar_item', op: 'patch', id: 'gin' },
      { table: 'drink_log', op: 'put', id: randomUUID() },
      bar('gin', true, 1),
    ]);
    expect(result).toEqual({ applied: 1, skipped: 6 });
  });

  it('cascades user deletion to all user data', async () => {
    const u = await newUser();
    await apply(u, [
      bar('gin', true, 1),
      { table: 'favorite', op: 'put', id: 'negroni', data: { is_favorite: true, updated_at: 1 } },
      {
        table: 'drink_log',
        op: 'put',
        id: randomUUID(),
        data: { recipe_id: 'negroni', made_at: 1 },
      },
    ]);
    await db.delete(user).where(eq(user.id, u));
    for (const table of [barItem, favorite, drinkLog, idempotencyKey]) {
      expect(await db.select().from(table).where(eq(table.userId, u))).toEqual([]);
    }
  });

  it('GET /v1/me/data returns current state without tombstones, history newest first', async () => {
    const u = await newUser();
    const [older, newer] = [randomUUID(), randomUUID()];
    await apply(u, [
      bar('vodka', true, 20),
      bar('gin', true, 10),
      bar('rum', true, 5),
      { table: 'bar_item', op: 'put', id: 'rum', data: { in_bar: false, updated_at: 6 } },
      { table: 'favorite', op: 'put', id: 'negroni', data: { is_favorite: true, updated_at: 1 } },
      { table: 'favorite', op: 'put', id: 'daiquiri', data: { is_favorite: false, updated_at: 1 } },
      { table: 'drink_log', op: 'put', id: older, data: { recipe_id: 'negroni', made_at: 100 } },
      { table: 'drink_log', op: 'put', id: newer, data: { recipe_id: 'daiquiri', made_at: 200 } },
    ]);
    const app = createApp({
      env: {
        CORS_ORIGINS: [],
        NODE_ENV: 'test',
        TRUST_PROXY_HOPS: 0,
        RATE_LIMIT_RECOMMEND_PER_MIN: 60,
      },
      catalog,
      userData: service,
      rateLimitStore: createMemoryRateLimitStore({ cleanupIntervalMs: 0 }),
      auth: fakeAuth(),
      ping: async () => {},
      logger: silentLogger,
    });
    const res = await app.request('/v1/me/data', { headers: { 'x-test-user': u } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      bar: ['gin', 'vodka'],
      favorites: ['negroni'],
      history: [
        { id: newer, recipeId: 'daiquiri', madeAt: 200 },
        { id: older, recipeId: 'negroni', madeAt: 100 },
      ],
    });

    const write = await app.request('/v1/me/changes', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'k', 'x-test-user': u },
      body: JSON.stringify({ ops: [bar('gin', false, 30)] }),
    });
    expect(await write.json()).toEqual({ applied: 1, skipped: 0 });
    const after = (await (
      await app.request('/v1/me/data', { headers: { 'x-test-user': u } })
    ).json()) as { bar: string[] };
    expect(after.bar).toEqual(['vodka']);
  });
});
