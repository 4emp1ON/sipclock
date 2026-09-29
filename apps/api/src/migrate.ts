// Applies pending SQL migrations from ./drizzle and exits. Runs as a one-shot container before the API.
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = postgres(url, { max: 1, connect_timeout: 10, onnotice: () => {} });
try {
  const migrationsFolder =
    process.env.MIGRATIONS_DIR ?? new URL('../drizzle', import.meta.url).pathname;
  await migrate(drizzle(sql), { migrationsFolder });
  console.log(JSON.stringify({ level: 'info', msg: 'migrations applied' }));
} catch (error) {
  console.error(JSON.stringify({ level: 'error', msg: 'migration failed', error: String(error) }));
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
