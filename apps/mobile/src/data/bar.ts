import type { Db } from './db';

/** Ingredient ids in the bar, oldest first. */
export async function listBar(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ ingredient_id: string }>(
    'SELECT ingredient_id FROM bar_item ORDER BY added_at, ingredient_id',
    [],
  );
  return rows.map((r) => r.ingredient_id);
}

export async function addToBar(db: Db, id: string, now: number = Date.now()): Promise<void> {
  await db.runAsync('INSERT OR IGNORE INTO bar_item (ingredient_id, added_at) VALUES (?, ?)', [
    id,
    now,
  ]);
}

export async function removeFromBar(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM bar_item WHERE ingredient_id = ?', [id]);
}

/** Replace the whole bar atomically; duplicate ids are ignored. */
export async function replaceBar(db: Db, ids: readonly string[], now: number = Date.now()) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM bar_item', []);
    for (const id of new Set(ids)) await addToBar(db, id, now);
  });
}
