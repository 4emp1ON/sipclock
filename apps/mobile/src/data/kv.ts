import type { Db } from './db';

export async function getValue(db: Db, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', [
    key,
  ]);
  return row?.value ?? null;
}

export async function setValue(db: Db, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

const RECENT_KEY = 'recent_picks';
export const RECENT_LIMIT = 10;

/** Put `id` first, drop earlier copies, keep at most `limit` entries. */
export function pushRecent(recent: readonly string[], id: string, limit = RECENT_LIMIT): string[] {
  return [id, ...recent.filter((r) => r !== id)].slice(0, limit);
}

export async function loadRecent(db: Db): Promise<string[]> {
  const raw = await getValue(db, RECENT_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveRecent(db: Db, recent: readonly string[]): Promise<void> {
  await setValue(db, RECENT_KEY, JSON.stringify(recent));
}
