import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { Db, DbExecutor } from './db';

const SYNCED: Record<string, string[]> = {
  bar_item: ['in_bar', 'updated_at'],
  favorite: ['is_favorite', 'updated_at'],
  drink_log: ['recipe_id', 'made_at'],
};

/**
 * In-memory SQLite (node:sqlite) standing in for PowerSync's views. Synced tables get triggers that record
 * PUT/PATCH/DELETE entries in `crud`, roughly like PowerSync's upload queue, so tests can assert what a write
 * would upload.
 */
export function createFakeDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE crud (seq INTEGER PRIMARY KEY AUTOINCREMENT, op TEXT, tbl TEXT, row_id TEXT, data TEXT);
    CREATE TABLE kv (id TEXT PRIMARY KEY NOT NULL, value TEXT);
  `);
  for (const [table, cols] of Object.entries(SYNCED)) {
    const json = (prefix: string) => cols.map((c) => `'${c}', ${prefix}.${c}`).join(', ');
    sqlite.exec(`
      CREATE TABLE ${table} (id TEXT PRIMARY KEY NOT NULL, ${cols.join(', ')});
      CREATE TRIGGER ${table}_put AFTER INSERT ON ${table} BEGIN
        INSERT INTO crud (op, tbl, row_id, data) VALUES ('PUT', '${table}', NEW.id, json_object(${json('NEW')}));
      END;
      CREATE TRIGGER ${table}_patch AFTER UPDATE ON ${table} BEGIN
        INSERT INTO crud (op, tbl, row_id, data) VALUES ('PATCH', '${table}', NEW.id, json_object(${json('NEW')}));
      END;
      CREATE TRIGGER ${table}_delete AFTER DELETE ON ${table} BEGIN
        INSERT INTO crud (op, tbl, row_id, data) VALUES ('DELETE', '${table}', OLD.id, NULL);
      END;
    `);
  }

  let failNext = false;
  const params = (p?: unknown[]) => (p ?? []) as SQLInputValue[];

  const exec: DbExecutor = {
    async execute(sql, p) {
      if (failNext) {
        failNext = false;
        throw new Error('boom');
      }
      return sqlite.prepare(sql).run(...params(p));
    },
    async getAll<T>(sql: string, p?: unknown[]) {
      return sqlite.prepare(sql).all(...params(p)) as T[];
    },
    async getOptional<T>(sql: string, p?: unknown[]) {
      return (sqlite.prepare(sql).get(...params(p)) ?? null) as T | null;
    },
  };

  let lock: Promise<unknown> = Promise.resolve();
  const db: Db = {
    ...exec,
    writeTransaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T> {
      const run = lock.then(async () => {
        sqlite.exec('BEGIN');
        try {
          const result = await fn(exec);
          sqlite.exec('COMMIT');
          return result;
        } catch (e) {
          sqlite.exec('ROLLBACK');
          throw e;
        }
      });
      lock = run.catch(() => undefined);
      return run;
    },
  };

  return {
    db,
    /** Upload-queue entries recorded so far, oldest first. */
    crud(): { op: string; table: string; id: string; data: Record<string, unknown> | null }[] {
      return (
        sqlite.prepare('SELECT op, tbl, row_id, data FROM crud ORDER BY seq').all() as {
          op: string;
          tbl: string;
          row_id: string;
          data: string | null;
        }[]
      ).map((r) => ({
        op: r.op,
        table: r.tbl,
        id: r.row_id,
        data: r.data ? JSON.parse(r.data) : null,
      }));
    },
    failNextWrite() {
      failNext = true;
    },
  };
}
