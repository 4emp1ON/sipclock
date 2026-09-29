import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.ts';

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export interface DbHandle {
  db: Database;
  /** Round-trips `select 1`; rejects when the database is unreachable. */
  ping(): Promise<void>;
  close(): Promise<void>;
}

/** Creates a lazily-connecting postgres.js pool wrapped with drizzle. */
export function createDb(url: string, options: { max?: number } = {}): DbHandle {
  const sql = postgres(url, {
    max: options.max ?? 10,
    connect_timeout: 5,
    idle_timeout: 30,
  });
  const db = drizzle(sql, { schema });
  return {
    db,
    ping: async () => {
      await sql`select 1`;
    },
    close: () => sql.end({ timeout: 5 }),
  };
}
