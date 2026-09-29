import type { Db } from './db';

type Param = string | number;

/** In-memory stand-in for the SQL used by the repositories. Recognizes exactly those statements. */
export function createFakeDb() {
  const bar = new Map<string, number>();
  const kv = new Map<string, string>();
  let userVersion = 0;
  const executed: string[] = [];
  let failNextRun = false;

  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

  const db: Db = {
    async execAsync(source) {
      executed.push(norm(source));
      const m = /^PRAGMA user_version = (\d+)$/.exec(norm(source));
      if (m) userVersion = Number(m[1]);
      // CREATE TABLE statements are no-ops: the maps always exist.
    },
    async runAsync(source, params: Param[]) {
      if (failNextRun) {
        failNextRun = false;
        throw new Error('boom');
      }
      const sql = norm(source);
      if (sql.startsWith('INSERT OR IGNORE INTO bar_item')) {
        const [id, at] = params as [string, number];
        if (!bar.has(id)) bar.set(id, at);
      } else if (sql === 'DELETE FROM bar_item') {
        bar.clear();
      } else if (sql === 'DELETE FROM bar_item WHERE ingredient_id = ?') {
        bar.delete(params[0] as string);
      } else if (sql.startsWith('INSERT INTO kv')) {
        kv.set(params[0] as string, params[1] as string);
      } else {
        throw new Error(`fake db: unsupported run: ${sql}`);
      }
      return {};
    },
    async getAllAsync<T>(source: string) {
      const sql = norm(source);
      if (sql.startsWith('SELECT ingredient_id FROM bar_item')) {
        return [...bar.entries()]
          .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
          .map(([ingredient_id]) => ({ ingredient_id })) as T[];
      }
      throw new Error(`fake db: unsupported all: ${sql}`);
    },
    async getFirstAsync<T>(source: string, params: Param[]) {
      const sql = norm(source);
      if (sql === 'PRAGMA user_version') return { user_version: userVersion } as T;
      if (sql === 'SELECT value FROM kv WHERE key = ?') {
        const v = kv.get(params[0] as string);
        return (v === undefined ? null : { value: v }) as T | null;
      }
      throw new Error(`fake db: unsupported first: ${sql}`);
    },
    async withTransactionAsync(task) {
      const snapshot = new Map(bar);
      try {
        await task();
      } catch (e) {
        bar.clear();
        for (const [k, v] of snapshot) bar.set(k, v);
        throw e;
      }
    },
  };

  return {
    db,
    executed,
    get userVersion() {
      return userVersion;
    },
    failNextRun() {
      failNextRun = true;
    },
  };
}
