import type { ChangeOp, DrinkLogEntry, UserDataSnapshot } from '@sipclock/domain';

// Client store for the bar, favorites and drink history (docs/adr/0006).
// Guest: localStorage. Signed in: GET /api/me/data, optimistic writes through POST /api/me/changes.
// Framework-free so it can be tested without React; the hook lives in use-user-data.ts.

export const BAR_KEY = 'sipclock.bar';
export const FAVORITES_KEY = 'sipclock.favorites';
/** Guest data on its way into an account: survives reloads so a retry reuses the same ops and keys. */
export const MERGE_KEY = 'sipclock.merge';

/** Mirrors MAX_CHANGE_OPS in @sipclock/domain (not imported: it would pull zod into the client bundle). */
const MAX_OPS_PER_REQUEST = 500;

export type SyncError = 'sync' | 'load' | 'merge';

export interface UserDataState {
  /** `pending` = the session is not known yet; storage behaves as in guest mode. */
  mode: 'pending' | 'guest' | 'signed-in';
  /** False until the client has read local data (guest) or the first snapshot (signed in). */
  ready: boolean;
  bar: readonly string[];
  favorites: readonly string[];
  history: readonly DrinkLogEntry[];
  error: SyncError | null;
}

export const INITIAL_STATE: UserDataState = {
  mode: 'pending',
  ready: false,
  bar: [],
  favorites: [],
  history: [],
  error: null,
};

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface UserDataDeps {
  fetch: typeof fetch;
  /** Called on every access so a blocked or missing storage never throws at import time. */
  storage: () => KeyValueStorage | null;
  now: () => number;
  uuid: () => string;
  knownIngredients: ReadonlySet<string>;
  knownRecipes: ReadonlySet<string>;
}

interface MergeRecord {
  userId: string;
  chunks: { key: string; ops: ChangeOp[] }[];
}

export interface UserDataStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): UserDataState;
  getServerSnapshot(): UserDataState;
  /** Reads guest data; idempotent. Call once on the client after mount. */
  start(): void;
  /** `undefined` = session still loading, `null` = signed out, string = signed-in user id. */
  setSession(userId: string | null | undefined): void;
  toggleBar(id: string): void;
  clearBar(): void;
  toggleFavorite(id: string): void;
  logDrink(recipeId: string): void;
  dismissError(): void;
}

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

/** Ops that move guest data into an account: only positive flags, guests have no tombstones. */
export function buildMergeOps(
  bar: readonly string[],
  favorites: readonly string[],
  at: number,
): ChangeOp[] {
  return [
    ...bar.map(
      (id): ChangeOp => ({
        table: 'bar_item',
        op: 'put',
        id,
        data: { in_bar: true, updated_at: at },
      }),
    ),
    ...favorites.map(
      (id): ChangeOp => ({
        table: 'favorite',
        op: 'put',
        id,
        data: { is_favorite: true, updated_at: at },
      }),
    ),
  ];
}

export function chunkOps(ops: ChangeOp[], size = MAX_OPS_PER_REQUEST): ChangeOp[][] {
  const out: ChangeOp[][] = [];
  for (let i = 0; i < ops.length; i += size) out.push(ops.slice(i, i + size));
  return out;
}

const without = (list: readonly string[], id: string) => list.filter((x) => x !== id);
const withId = (list: readonly string[], id: string) => (list.includes(id) ? list : [...list, id]);

export function createUserDataStore(deps: UserDataDeps): UserDataStore {
  let state: UserDataState = INITIAL_STATE;
  const listeners = new Set<() => void>();
  let session: string | null | undefined;
  let started = false;
  /** Bumped on every session change; results of older sessions are discarded. */
  let generation = 0;
  let lastStamp = 0;
  let queued: (() => void)[] = [];

  const set = (patch: Partial<UserDataState>) => {
    state = { ...state, ...patch };
    for (const l of listeners) l();
  };
  const update = (fn: (s: UserDataState) => Partial<UserDataState>) => set(fn(state));

  /** Strictly increasing client clock so two writes to one row in the same millisecond still order. */
  const stamp = () => {
    lastStamp = Math.max(deps.now(), lastStamp + 1);
    return lastStamp;
  };

  const storageGet = (key: string): string | null => {
    try {
      return deps.storage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };
  const storageSet = (key: string, value: string) => {
    try {
      deps.storage()?.setItem(key, value);
    } catch {
      // Storage may be blocked; guest data then lasts for this visit only.
    }
  };
  const storageRemove = (key: string) => {
    try {
      deps.storage()?.removeItem(key);
    } catch {
      // Ignored, see storageSet.
    }
  };

  const readIds = (key: string, known: ReadonlySet<string>): string[] => {
    try {
      const raw = storageGet(key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((x): x is string => typeof x === 'string' && known.has(x));
    } catch {
      return [];
    }
  };
  const readGuest = () => ({
    bar: readIds(BAR_KEY, deps.knownIngredients),
    favorites: readIds(FAVORITES_KEY, deps.knownRecipes),
  });

  const readMergeRecord = (): MergeRecord | null => {
    try {
      const raw = storageGet(MERGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as MergeRecord) : null;
      return parsed && typeof parsed.userId === 'string' && Array.isArray(parsed.chunks)
        ? parsed
        : null;
    } catch {
      return null;
    }
  };

  async function post(ops: ChangeOp[], key: string): Promise<void> {
    const send = async () => {
      const res = await deps.fetch('/api/me/changes', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': key },
        body: JSON.stringify({ ops }),
      });
      if (!res.ok) throw new HttpError(res.status);
    };
    try {
      await send();
    } catch (error) {
      if (error instanceof HttpError) throw error;
      await send(); // Network error: the same key makes the retry safe.
    }
  }

  async function fetchSnapshot(): Promise<UserDataSnapshot> {
    const res = await deps.fetch('/api/me/data', { headers: { accept: 'application/json' } });
    if (!res.ok) throw new HttpError(res.status);
    return (await res.json()) as UserDataSnapshot;
  }

  /** Sends guest data to the account once, then clears it. Safe to call again after a failure or reload. */
  async function mergeGuestData(userId: string): Promise<void> {
    let record = readMergeRecord();
    if (!record || record.userId !== userId) {
      const guest = readGuest();
      const ops = buildMergeOps(guest.bar, guest.favorites, deps.now());
      if (ops.length === 0) {
        storageRemove(MERGE_KEY);
        return;
      }
      record = { userId, chunks: chunkOps(ops).map((chunk) => ({ key: deps.uuid(), ops: chunk })) };
      storageSet(MERGE_KEY, JSON.stringify(record));
    }
    for (const chunk of record.chunks) await post(chunk.ops, chunk.key);
    storageRemove(BAR_KEY);
    storageRemove(FAVORITES_KEY);
    storageRemove(MERGE_KEY);
  }

  async function activate(userId: string, gen: number) {
    let error: SyncError | null = null;
    try {
      await mergeGuestData(userId);
    } catch {
      error = 'merge';
    }
    let snapshot: UserDataSnapshot | null = null;
    try {
      snapshot = await fetchSnapshot();
    } catch {
      error = 'load';
    }
    if (gen !== generation) return;
    set({
      ready: true,
      bar: snapshot?.bar ?? [],
      favorites: snapshot?.favorites ?? [],
      history: snapshot?.history ?? [],
      error,
    });
    const run = queued;
    queued = [];
    for (const fn of run) fn();
  }

  function enterGuest(mode: 'pending' | 'guest') {
    generation++;
    queued = [];
    // An unfinished merge is rebuilt from the guest data at the next sign-in, so items added as a guest
    // in between are not dropped by replaying the old record. The guest keys are still there: they are
    // only removed after a merge succeeds.
    if (mode === 'guest') storageRemove(MERGE_KEY);
    set({ mode, ready: true, ...readGuest(), history: [], error: null });
  }

  /** Runs `fn` now, or once the signed-in snapshot has arrived. */
  const whenReady = (fn: () => void) => {
    if (state.mode === 'signed-in' && !state.ready) queued.push(fn);
    else fn();
  };

  /** Applies `optimistic`, sends `ops`; on failure applies `revert` and raises the notice. */
  function write(
    ops: ChangeOp[],
    optimistic: (s: UserDataState) => Partial<UserDataState>,
    revert: (s: UserDataState) => Partial<UserDataState>,
  ) {
    const gen = generation;
    update(optimistic);
    post(ops, deps.uuid()).catch(() => {
      if (gen !== generation) return;
      update((s) => ({ ...revert(s), error: 'sync' }));
    });
  }

  const signedIn = () => state.mode === 'signed-in';

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,
    getServerSnapshot: () => INITIAL_STATE,

    start() {
      if (started) return;
      started = true;
      if (session === undefined) enterGuest('pending');
    },

    setSession(userId) {
      started = true;
      if (session === userId) return;
      session = userId;
      if (typeof userId === 'string') {
        generation++;
        queued = [];
        // Keep showing what is on screen until the snapshot replaces it.
        set({ mode: 'signed-in', ready: false, error: null });
        void activate(userId, generation);
      } else {
        enterGuest(userId === null ? 'guest' : 'pending');
      }
    },

    toggleBar(id) {
      whenReady(() => {
        const had = state.bar.includes(id);
        if (!signedIn()) {
          const bar = had ? without(state.bar, id) : withId(state.bar, id);
          storageSet(BAR_KEY, JSON.stringify(bar));
          set({ bar });
          return;
        }
        write(
          [{ table: 'bar_item', op: 'put', id, data: { in_bar: !had, updated_at: stamp() } }],
          (s) => ({ bar: had ? without(s.bar, id) : withId(s.bar, id) }),
          (s) => ({ bar: had ? withId(s.bar, id) : without(s.bar, id) }),
        );
      });
    },

    clearBar() {
      whenReady(() => {
        const previous = state.bar;
        if (previous.length === 0) return;
        if (!signedIn()) {
          storageSet(BAR_KEY, '[]');
          set({ bar: [] });
          return;
        }
        const at = stamp();
        write(
          previous.map(
            (id): ChangeOp => ({
              table: 'bar_item',
              op: 'put',
              id,
              data: { in_bar: false, updated_at: at },
            }),
          ),
          () => ({ bar: [] }),
          (s) => ({ bar: [...previous, ...s.bar.filter((x) => !previous.includes(x))] }),
        );
      });
    },

    toggleFavorite(id) {
      whenReady(() => {
        const had = state.favorites.includes(id);
        if (!signedIn()) {
          const favorites = had ? without(state.favorites, id) : withId(state.favorites, id);
          storageSet(FAVORITES_KEY, JSON.stringify(favorites));
          set({ favorites });
          return;
        }
        write(
          [{ table: 'favorite', op: 'put', id, data: { is_favorite: !had, updated_at: stamp() } }],
          (s) => ({ favorites: had ? without(s.favorites, id) : withId(s.favorites, id) }),
          (s) => ({ favorites: had ? withId(s.favorites, id) : without(s.favorites, id) }),
        );
      });
    },

    logDrink(recipeId) {
      // Guests have no history; the UI prompts them to sign in instead.
      if (!signedIn()) return;
      whenReady(() => {
        const entry: DrinkLogEntry = { id: deps.uuid(), recipeId, madeAt: stamp() };
        write(
          [
            {
              table: 'drink_log',
              op: 'put',
              id: entry.id,
              data: { recipe_id: recipeId, made_at: entry.madeAt },
            },
          ],
          (s) => ({ history: [entry, ...s.history] }),
          (s) => ({ history: s.history.filter((h) => h.id !== entry.id) }),
        );
      });
    },

    dismissError() {
      if (state.error) set({ error: null });
    },
  };
}
