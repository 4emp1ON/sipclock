import { usePowerSync, useQuery } from '@powersync/react-native';
import type { DrinkLogEntry } from '@sipclock/domain';
import { useCallback, useMemo } from 'react';

import { LIST_FAVORITES_SQL, toggleFavorite } from '@/data/favorites';
import { type DrinkLogRow, LIST_HISTORY_SQL, logDrink, toEntry } from '@/data/history';
import { parseRecent, pushRecentPick, RECENT_KEY } from '@/data/kv';
import { uuidV4 } from '@/lib/uuid';

const warn = (what: string) => (e: unknown) => console.warn(`[data] ${what} failed`, e);

/** Favorite recipe ids, most recently saved first; `null` while loading. */
export function useFavorites(): readonly string[] | null {
  const { data, isLoading } = useQuery<{ id: string }>(LIST_FAVORITES_SQL);
  return useMemo(() => (isLoading ? null : data.map((r) => r.id)), [data, isLoading]);
}

/** Whether one recipe is saved, and a toggle for it. */
export function useFavorite(recipeId: string | undefined) {
  const db = usePowerSync();
  const { data } = useQuery<{ is_favorite: number }>(
    'SELECT is_favorite FROM favorite WHERE id = ?',
    [recipeId ?? ''],
  );
  const saved = data[0]?.is_favorite === 1;
  const toggle = useCallback(() => {
    if (recipeId) toggleFavorite(db, recipeId).catch(warn('favorite'));
  }, [db, recipeId]);
  return { saved, toggle };
}

/** Drink log, newest first; `null` while loading. */
export function useHistory(): readonly DrinkLogEntry[] | null {
  const { data, isLoading } = useQuery<DrinkLogRow>(LIST_HISTORY_SQL);
  return useMemo(() => (isLoading ? null : data.map(toEntry)), [data, isLoading]);
}

/** Record that a drink was made: a history entry, and a recent pick so Today suggests something else. */
export function useLogDrink() {
  const db = usePowerSync();
  return useCallback(
    async (recipeId: string) => {
      await logDrink(db, { id: uuidV4(), recipeId, madeAt: Date.now() });
      pushRecentPick(db, recipeId).catch(warn('recent pick'));
    },
    [db],
  );
}

/** Recent picks stored on this device, newest first (reactive). */
export function useStoredRecent(): { recent: readonly string[]; loaded: boolean } {
  const { data, isLoading } = useQuery<{ value: string | null }>(
    'SELECT value FROM kv WHERE id = ?',
    [RECENT_KEY],
  );
  const raw = data[0]?.value ?? null;
  const recent = useMemo(() => parseRecent(raw), [raw]);
  return { recent, loaded: !isLoading };
}
