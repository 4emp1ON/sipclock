import { usePowerSync, useQuery } from '@powersync/react-native';
import { createContext, type ReactNode, useCallback, useContext, useMemo } from 'react';

import { LIST_BAR_SQL, replaceBar, toggleBar } from '@/data/bar';

export interface BarApi {
  /** Ingredient ids in the bar; `null` until the first load finishes. */
  ids: readonly string[] | null;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  replaceAll: (ids: readonly string[]) => void;
  clear: () => void;
}

const BarContext = createContext<BarApi | null>(null);

const warn = (e: unknown) => console.warn('[bar] write failed', e);

/**
 * Owns the bar for the whole app: one watched query over the local database, which re-emits after every
 * local write (a few ms) and after sync brings changes from other devices.
 */
export function BarProvider({ children }: { children: ReactNode }) {
  const db = usePowerSync();
  const { data, isLoading } = useQuery<{ id: string }>(LIST_BAR_SQL);

  const ids = useMemo(() => (isLoading ? null : data.map((r) => r.id)), [data, isLoading]);

  const toggle = useCallback(
    (id: string) => {
      toggleBar(db, id).catch(warn);
    },
    [db],
  );

  const replaceAll = useCallback(
    (next: readonly string[]) => {
      replaceBar(db, next).catch(warn);
    },
    [db],
  );

  const value = useMemo<BarApi>(() => {
    const set = new Set(ids ?? []);
    return {
      ids,
      has: (id) => set.has(id),
      toggle,
      replaceAll,
      clear: () => replaceAll([]),
    };
  }, [ids, toggle, replaceAll]);

  return <BarContext.Provider value={value}>{children}</BarContext.Provider>;
}

export function useBar(): BarApi {
  const ctx = useContext(BarContext);
  if (!ctx) throw new Error('useBar must be used within <BarProvider>');
  return ctx;
}
