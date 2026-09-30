import type { DrinkLogEntry } from '@sipclock/domain';

import type { DbExecutor } from './db';

export const HISTORY_LIMIT = 200;

/** Drink log, newest first. Also used by the reactive hook. */
export const LIST_HISTORY_SQL = `SELECT id, recipe_id, made_at FROM drink_log ORDER BY made_at DESC, id LIMIT ${HISTORY_LIMIT}`;

export interface DrinkLogRow {
  id: string;
  recipe_id: string;
  made_at: number;
}

export const toEntry = (r: DrinkLogRow): DrinkLogEntry => ({
  id: r.id,
  recipeId: r.recipe_id,
  madeAt: r.made_at,
});

export async function listHistory(db: DbExecutor): Promise<DrinkLogEntry[]> {
  return (await db.getAll<DrinkLogRow>(LIST_HISTORY_SQL)).map(toEntry);
}

export async function logDrink(
  db: DbExecutor,
  entry: { id: string; recipeId: string; madeAt: number },
): Promise<void> {
  await db.execute('INSERT INTO drink_log (id, recipe_id, made_at) VALUES (?, ?, ?)', [
    entry.id,
    entry.recipeId,
    entry.madeAt,
  ]);
}
