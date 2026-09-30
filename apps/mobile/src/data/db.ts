/**
 * The slice of PowerSync's database API that the repositories use. `PowerSyncDatabase` satisfies it, and so
 * does the SQLite-backed fake in tests, so repository logic stays testable without native modules.
 *
 * Tables are PowerSync views (see src/data/schema.ts): every row has a text `id`. Writes to synced tables are
 * recorded in PowerSync's upload queue; `kv` is local-only and never uploaded.
 */
export interface DbExecutor {
  execute(sql: string, params?: unknown[]): Promise<unknown>;
  getAll<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getOptional<T>(sql: string, params?: unknown[]): Promise<T | null>;
}

export interface Db extends DbExecutor {
  writeTransaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T>;
}

export const DATABASE_FILENAME = 'sipclock-sync.db';
