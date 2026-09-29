/** The slice of expo-sqlite's async `SQLiteDatabase` that the repositories use (also implemented by the test fake). */
export interface Db {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: (string | number)[]): Promise<unknown>;
  getAllAsync<T>(source: string, params: (string | number)[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params: (string | number)[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export const DATABASE_NAME = 'sipclock.db';

/** Ordered, append-only. Index + 1 is the `PRAGMA user_version` after the step ran. */
export const MIGRATIONS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS bar_item (
     ingredient_id TEXT PRIMARY KEY NOT NULL,
     added_at INTEGER NOT NULL
   );
   CREATE TABLE IF NOT EXISTS kv (
     key TEXT PRIMARY KEY NOT NULL,
     value TEXT NOT NULL
   );`,
];

/** Idempotent: applies only the migrations newer than the database's `user_version`. */
export async function migrate(db: Db): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version++) {
    const sql = MIGRATIONS[version] as string;
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
