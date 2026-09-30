import type { Db, DbExecutor } from './db';

// `INSERT OR REPLACE` on a PowerSync view records a PUT with every column, which is what the server contract
// needs (a PATCH carries only changed columns). Removals are tombstones: `in_bar = 0` with a newer clock.
// The clock never goes back on a row: a device whose clock is behind the last writer (another device, or two
// writes in one millisecond) would otherwise lose last-writer-wins and see its change reverted.
const PUT_BAR_ITEM = `INSERT OR REPLACE INTO bar_item (id, in_bar, updated_at)
  VALUES (?1, ?2, max(?3, coalesce((SELECT updated_at + 1 FROM bar_item WHERE id = ?1), 0)))`;

/** Query for the ids in the bar, oldest first. Also used by the reactive hook. */
export const LIST_BAR_SQL = 'SELECT id FROM bar_item WHERE in_bar = 1 ORDER BY updated_at, id';

export async function listBar(db: DbExecutor): Promise<string[]> {
  const rows = await db.getAll<{ id: string }>(LIST_BAR_SQL);
  return rows.map((r) => r.id);
}

export async function setInBar(
  db: DbExecutor,
  id: string,
  inBar: boolean,
  now: number = Date.now(),
): Promise<void> {
  await db.execute(PUT_BAR_ITEM, [id, inBar ? 1 : 0, now]);
}

/** Flip one ingredient. Read and write happen in one write transaction, so rapid taps apply in order. */
export async function toggleBar(db: Db, id: string, now: number = Date.now()): Promise<boolean> {
  return db.writeTransaction(async (tx) => {
    const row = await tx.getOptional<{ in_bar: number }>(
      'SELECT in_bar FROM bar_item WHERE id = ?',
      [id],
    );
    const next = row?.in_bar !== 1;
    await setInBar(tx, id, next, now);
    return next;
  });
}

/** Make the bar exactly `ids`: add what is missing, tombstone the rest, leave unchanged rows alone. */
export async function replaceBar(
  db: Db,
  ids: readonly string[],
  now: number = Date.now(),
): Promise<void> {
  const wanted = new Set(ids);
  await db.writeTransaction(async (tx) => {
    const current = new Set(await listBar(tx));
    for (const id of current) if (!wanted.has(id)) await setInBar(tx, id, false, now);
    for (const id of wanted) if (!current.has(id)) await setInBar(tx, id, true, now);
  });
}
