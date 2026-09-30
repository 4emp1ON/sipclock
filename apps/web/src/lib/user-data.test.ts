import type { ChangeOp, UserDataSnapshot } from '@sipclock/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BAR_KEY,
  buildMergeOps,
  chunkOps,
  createUserDataStore,
  FAVORITES_KEY,
  MERGE_KEY,
  type UserDataStore,
} from './user-data';

interface Call {
  url: string;
  method: string;
  key: string | null;
  ops?: ChangeOp[];
}

function setup(
  opts: { snapshot?: UserDataSnapshot; failPosts?: number; networkFailures?: number } = {},
) {
  const data = new Map<string, string>();
  const calls: Call[] = [];
  let failPosts = opts.failPosts ?? 0;
  let networkFailures = opts.networkFailures ?? 0;
  let n = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    const call: Call = {
      url,
      method: init?.method ?? 'GET',
      key: headers.get('idempotency-key'),
      ops: init?.body ? (JSON.parse(String(init.body)) as { ops: ChangeOp[] }).ops : undefined,
    };
    calls.push(call);
    if (url === '/api/me/data') {
      return Response.json(opts.snapshot ?? { bar: [], favorites: [], history: [] });
    }
    if (networkFailures > 0) {
      networkFailures--;
      throw new TypeError('network');
    }
    if (failPosts > 0) {
      failPosts--;
      return new Response('{}', { status: 500 });
    }
    return Response.json({ applied: call.ops?.length ?? 0, skipped: 0 });
  });
  let clock = 1_000;
  const store = createUserDataStore({
    fetch: fetchMock as unknown as typeof fetch,
    storage: () => ({
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    }),
    now: () => clock++,
    uuid: () => `id-${++n}`,
    knownIngredients: new Set(['gin', 'vermouth', 'campari']),
    knownRecipes: new Set(['negroni', 'martini']),
  });
  return { store, data, calls, posts: () => calls.filter((c) => c.method === 'POST') };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const ready = async (store: UserDataStore) => {
  for (let i = 0; i < 20 && !store.getSnapshot().ready; i++) await flush();
};

describe('guest mode', () => {
  it('reads valid ids from localStorage and writes back', async () => {
    const { store, data, calls } = setup();
    data.set(BAR_KEY, JSON.stringify(['gin', 'unknown', 3]));
    store.setSession(null);
    expect(store.getSnapshot()).toMatchObject({ mode: 'guest', ready: true, bar: ['gin'] });
    store.toggleBar('vermouth');
    store.toggleBar('gin');
    expect(store.getSnapshot().bar).toEqual(['vermouth']);
    expect(data.get(BAR_KEY)).toBe('["vermouth"]');
    store.toggleFavorite('negroni');
    expect(data.get(FAVORITES_KEY)).toBe('["negroni"]');
    store.clearBar();
    expect(data.get(BAR_KEY)).toBe('[]');
    expect(calls).toHaveLength(0);
  });

  it('starts in pending mode using guest storage and ignores drink logging', () => {
    const { store, data, calls } = setup();
    data.set(FAVORITES_KEY, '["martini"]');
    store.start();
    expect(store.getSnapshot()).toMatchObject({ mode: 'pending', favorites: ['martini'] });
    store.logDrink('negroni');
    expect(store.getSnapshot().history).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe('signed-in mode', () => {
  it('loads the snapshot and sends toggles as tombstone-style puts with idempotency keys', async () => {
    const { store, posts } = setup({
      snapshot: { bar: ['gin'], favorites: [], history: [] },
    });
    store.setSession('u1');
    await ready(store);
    expect(store.getSnapshot()).toMatchObject({ mode: 'signed-in', bar: ['gin'] });
    store.toggleBar('gin');
    store.toggleBar('campari');
    expect(store.getSnapshot().bar).toEqual(['campari']);
    await flush();
    const [remove, add] = posts();
    expect(remove?.ops).toEqual([
      {
        table: 'bar_item',
        op: 'put',
        id: 'gin',
        data: { in_bar: false, updated_at: expect.any(Number) },
      },
    ]);
    expect(add?.ops?.[0]?.data).toMatchObject({ in_bar: true });
    expect(remove?.key).not.toBe(add?.key);
    const t = (c?: Call) =>
      (c?.ops?.[0]?.data as { updated_at: number } | undefined)?.updated_at ?? 0;
    expect(t(add)).toBeGreaterThan(t(remove));
  });

  it('rolls back an optimistic write and raises a notice on failure', async () => {
    const { store } = setup({ failPosts: 1 });
    store.setSession('u1');
    await ready(store);
    store.toggleFavorite('negroni');
    expect(store.getSnapshot().favorites).toEqual(['negroni']);
    await flush();
    expect(store.getSnapshot().favorites).toEqual([]);
    expect(store.getSnapshot().error).toBe('sync');
    store.dismissError();
    expect(store.getSnapshot().error).toBeNull();
  });

  it('retries a network error once with the same key', async () => {
    const { store, posts } = setup({ networkFailures: 1 });
    store.setSession('u1');
    await ready(store);
    store.toggleFavorite('martini');
    await flush();
    expect(posts()).toHaveLength(2);
    expect(posts()[0]?.key).toBe(posts()[1]?.key);
    expect(store.getSnapshot().favorites).toEqual(['martini']);
    expect(store.getSnapshot().error).toBeNull();
  });

  it('logs drinks with a uuid id and newest first, rolling back on failure', async () => {
    const { store, posts } = setup({
      snapshot: {
        bar: [],
        favorites: [],
        history: [{ id: 'old', recipeId: 'martini', madeAt: 1 }],
      },
    });
    store.setSession('u1');
    await ready(store);
    store.logDrink('negroni');
    const [first, second] = store.getSnapshot().history;
    expect(first).toMatchObject({ recipeId: 'negroni' });
    expect(second?.id).toBe('old');
    await flush();
    expect(posts()[0]?.ops?.[0]).toEqual({
      table: 'drink_log',
      op: 'put',
      id: first?.id,
      data: { recipe_id: 'negroni', made_at: first?.madeAt },
    });
  });

  it('rolls back a failed drink log', async () => {
    const { store } = setup({ failPosts: 1 });
    store.setSession('u1');
    await ready(store);
    store.logDrink('negroni');
    expect(store.getSnapshot().history).toHaveLength(1);
    await flush();
    expect(store.getSnapshot().history).toHaveLength(0);
  });

  it('clearBar sends one tombstone per item and restores them on failure', async () => {
    const { store, posts } = setup({
      snapshot: { bar: ['gin', 'vermouth'], favorites: [], history: [] },
      failPosts: 1,
    });
    store.setSession('u1');
    await ready(store);
    store.clearBar();
    expect(store.getSnapshot().bar).toEqual([]);
    await flush();
    expect(posts()[0]?.ops).toHaveLength(2);
    expect(store.getSnapshot().bar).toEqual(['gin', 'vermouth']);
  });

  it('signing out returns to (empty) guest data', async () => {
    const { store } = setup({ snapshot: { bar: ['gin'], favorites: ['negroni'], history: [] } });
    store.setSession('u1');
    await ready(store);
    store.setSession(null);
    expect(store.getSnapshot()).toMatchObject({
      mode: 'guest',
      bar: [],
      favorites: [],
      history: [],
    });
  });
});

describe('guest to account merge', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup({ snapshot: { bar: ['gin', 'vermouth'], favorites: ['negroni'], history: [] } });
    ctx.data.set(BAR_KEY, '["gin","vermouth"]');
    ctx.data.set(FAVORITES_KEY, '["negroni"]');
  });

  it('sends one batch before loading, then clears guest keys', async () => {
    ctx.store.setSession('u1');
    await ready(ctx.store);
    expect(ctx.calls.map((c) => c.method + c.url)).toEqual([
      'POST/api/me/changes',
      'GET/api/me/data',
    ]);
    const ops = ctx.posts()[0]?.ops ?? [];
    expect(ops).toHaveLength(3);
    expect(ops.map((o) => `${o.table}:${o.id}`)).toEqual([
      'bar_item:gin',
      'bar_item:vermouth',
      'favorite:negroni',
    ]);
    expect(ctx.data.has(BAR_KEY)).toBe(false);
    expect(ctx.data.has(FAVORITES_KEY)).toBe(false);
    expect(ctx.data.has(MERGE_KEY)).toBe(false);
    expect(ctx.store.getSnapshot().bar).toEqual(['gin', 'vermouth']);
  });

  it('does not merge twice: a second session start finds no guest data', async () => {
    ctx.store.setSession('u1');
    await ready(ctx.store);
    ctx.store.setSession(null);
    ctx.store.setSession('u1');
    await ready(ctx.store);
    expect(ctx.posts()).toHaveLength(1);
  });

  it('keeps guest data and reuses the same key and ops when the merge fails, then succeeds on retry', async () => {
    const failing = setup({ failPosts: 1 });
    failing.data.set(BAR_KEY, '["gin"]');
    failing.store.setSession('u1');
    await ready(failing.store);
    expect(failing.store.getSnapshot().error).toBe('merge');
    expect(failing.data.get(BAR_KEY)).toBe('["gin"]');
    const firstPost = failing.posts()[0];
    // Reload: a fresh store over the same storage.
    const again = setup();
    for (const [k, v] of failing.data) again.data.set(k, v);
    again.store.setSession('u1');
    await ready(again.store);
    const retry = again.posts()[0];
    expect(retry?.key).toBe(firstPost?.key);
    expect(retry?.ops).toEqual(firstPost?.ops);
    expect(again.data.has(BAR_KEY)).toBe(false);
  });
});

describe('merge helpers', () => {
  it('builds positive puts with one shared clock value', () => {
    expect(buildMergeOps(['gin'], ['negroni'], 5)).toEqual([
      { table: 'bar_item', op: 'put', id: 'gin', data: { in_bar: true, updated_at: 5 } },
      { table: 'favorite', op: 'put', id: 'negroni', data: { is_favorite: true, updated_at: 5 } },
    ]);
  });
  it('chunks to the per-request limit', () => {
    const ops = buildMergeOps(
      Array.from({ length: 5 }, (_, i) => `i${i}`),
      [],
      1,
    );
    expect(chunkOps(ops, 2).map((c) => c.length)).toEqual([2, 2, 1]);
  });
});
