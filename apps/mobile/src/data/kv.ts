import type { Db, DbExecutor } from './db';

// `kv` is a local-only PowerSync table: the key is the row id. It is never uploaded and survives sign-out.

export async function getValue(db: DbExecutor, key: string): Promise<string | null> {
  const row = await db.getOptional<{ value: string | null }>('SELECT value FROM kv WHERE id = ?', [
    key,
  ]);
  return row?.value ?? null;
}

export async function setValue(db: DbExecutor, key: string, value: string): Promise<void> {
  await db.execute('INSERT OR REPLACE INTO kv (id, value) VALUES (?, ?)', [key, value]);
}

export async function deleteValue(db: DbExecutor, key: string): Promise<void> {
  await db.execute('DELETE FROM kv WHERE id = ?', [key]);
}

export const RECENT_KEY = 'recent_picks';
export const RECENT_LIMIT = 10;

/** Put `id` first, drop earlier copies, keep at most `limit` entries. */
export function pushRecent(recent: readonly string[], id: string, limit = RECENT_LIMIT): string[] {
  return [id, ...recent.filter((r) => r !== id)].slice(0, limit);
}

/** Merge picks made in this session in front of the stored history. */
export function mergeRecent(
  early: readonly string[],
  stored: readonly string[],
  limit = RECENT_LIMIT,
): string[] {
  return [...new Set([...early, ...stored])].slice(0, limit);
}

export function parseRecent(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function loadRecent(db: DbExecutor): Promise<string[]> {
  return parseRecent(await getValue(db, RECENT_KEY));
}

export async function saveRecent(db: DbExecutor, recent: readonly string[]): Promise<void> {
  await setValue(db, RECENT_KEY, JSON.stringify(recent));
}

/** Read-modify-write in one transaction, so pushes from different screens never overwrite each other. */
export async function pushRecentPick(db: Db, id: string): Promise<void> {
  await db.writeTransaction(async (tx) => {
    await saveRecent(tx, pushRecent(await loadRecent(tx), id));
  });
}
