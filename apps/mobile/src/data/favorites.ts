import type { Db, DbExecutor } from './db';

/** Favorite recipe ids, most recently saved first. Also used by the reactive hook. */
export const LIST_FAVORITES_SQL =
  'SELECT id FROM favorite WHERE is_favorite = 1 ORDER BY updated_at DESC, id';

export async function listFavorites(db: DbExecutor): Promise<string[]> {
  const rows = await db.getAll<{ id: string }>(LIST_FAVORITES_SQL);
  return rows.map((r) => r.id);
}

/** Save or unsave a recipe. Unsaving is a tombstone (`is_favorite = 0`), never a delete. */
export async function setFavorite(
  db: DbExecutor,
  id: string,
  favorite: boolean,
  now: number = Date.now(),
): Promise<void> {
  // The clock never goes back on a row (see PUT_BAR_ITEM in bar.ts).
  await db.execute(
    `INSERT OR REPLACE INTO favorite (id, is_favorite, updated_at)
       VALUES (?1, ?2, max(?3, coalesce((SELECT updated_at + 1 FROM favorite WHERE id = ?1), 0)))`,
    [id, favorite ? 1 : 0, now],
  );
}

export async function toggleFavorite(db: Db, id: string, now: number = Date.now()) {
  return db.writeTransaction(async (tx) => {
    const row = await tx.getOptional<{ is_favorite: number }>(
      'SELECT is_favorite FROM favorite WHERE id = ?',
      [id],
    );
    const next = row?.is_favorite !== 1;
    await setFavorite(tx, id, next, now);
    return next;
  });
}
