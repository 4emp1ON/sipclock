'use client';

import { useSyncExternalStore } from 'react';
import { catalog } from '@/lib/catalog';
import { createUserDataStore, type UserDataState, type UserDataStore } from '@/lib/user-data';

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** One store per page; components share it. Created lazily-safe: nothing touches `window` until used. */
export const userDataStore: UserDataStore = createUserDataStore({
  fetch: (input, init) => fetch(input, { ...init, credentials: 'same-origin' }),
  storage: browserStorage,
  now: () => Date.now(),
  uuid: () => crypto.randomUUID(),
  knownIngredients: new Set(catalog.ingredients.map((i) => i.id)),
  knownRecipes: new Set(catalog.recipes.map((r) => r.id)),
});

export type UserData = UserDataState &
  Pick<UserDataStore, 'toggleBar' | 'clearBar' | 'toggleFavorite' | 'logDrink' | 'dismissError'>;

/** Reads the shared user data store. `UserDataBoundary` (in the site layout) feeds it the session. */
export function useUserData(): UserData {
  const state = useSyncExternalStore(
    userDataStore.subscribe,
    userDataStore.getSnapshot,
    userDataStore.getServerSnapshot,
  );
  return {
    ...state,
    toggleBar: userDataStore.toggleBar,
    clearBar: userDataStore.clearBar,
    toggleFavorite: userDataStore.toggleFavorite,
    logDrink: userDataStore.logDrink,
    dismissError: userDataStore.dismissError,
  };
}
