import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb } from './client.ts';

describe.skipIf(!process.env.DATABASE_URL)('database (integration)', () => {
  const handle = createDb(process.env.DATABASE_URL ?? '');
  afterAll(() => handle.close());

  it('connects and runs select 1', async () => {
    await expect(handle.ping()).resolves.toBeUndefined();
    const rows = await handle.db.execute<{ one: number }>(sql`select 1 as one`);
    expect(rows[0]?.one).toBe(1);
  });
});
