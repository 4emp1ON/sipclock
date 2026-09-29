import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { addToBar, listBar, removeFromBar, replaceBar } from '@/data/bar';

export interface BarApi {
  /** Ingredient ids in the bar; `null` until the first load finishes. */
  ids: readonly string[] | null;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  replaceAll: (ids: readonly string[]) => void;
  clear: () => void;
}

const BarContext = createContext<BarApi | null>(null);

/** Owns the bar state for the whole app: optimistic updates, writes serialized, reload on failure. */
export function BarProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [ids, setIds] = useState<readonly string[] | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const current = useRef<readonly string[] | null>(null);

  const apply = useCallback((next: readonly string[]) => {
    current.current = next;
    setIds(next);
  }, []);

  const reload = useCallback(async () => {
    apply(await listBar(db));
  }, [db, apply]);

  useEffect(() => {
    reload().catch(() => apply([]));
  }, [reload, apply]);

  const enqueue = useCallback(
    (write: () => Promise<void>) => {
      queue.current = queue.current
        .then(write)
        .catch(() => reload())
        .catch(() => undefined);
    },
    [reload],
  );

  const toggle = useCallback(
    (id: string) => {
      const before = current.current;
      if (before === null) return; // still loading
      if (before.includes(id)) {
        apply(before.filter((x) => x !== id));
        enqueue(() => removeFromBar(db, id));
      } else {
        apply([...before, id]);
        enqueue(() => addToBar(db, id));
      }
    },
    [db, apply, enqueue],
  );

  const replaceAll = useCallback(
    (next: readonly string[]) => {
      const unique = [...new Set(next)];
      apply(unique);
      enqueue(() => replaceBar(db, unique));
    },
    [db, apply, enqueue],
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
