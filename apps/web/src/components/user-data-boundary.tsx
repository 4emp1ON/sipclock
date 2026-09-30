'use client';

import { useEffect } from 'react';
import { getUi, type Locale } from '@/i18n/ui';
import { authClient } from '@/lib/auth-client';
import { userDataStore, useUserData } from '@/lib/use-user-data';

const MESSAGE = { sync: 'failed', load: 'loadFailed', merge: 'mergeFailed' } as const;

/** Binds the auth session to the user data store and shows sync errors. Renders nothing while all is well. */
export function UserDataBoundary({ locale }: { locale: Locale }) {
  const ui = getUi(locale);
  const { data, isPending } = authClient.useSession();
  const userId = data?.user.id;
  const { error, dismissError } = useUserData();

  useEffect(() => {
    userDataStore.start();
    userDataStore.setSession(isPending ? undefined : (userId ?? null));
  }, [isPending, userId]);

  if (!error) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-md items-center justify-between gap-3 rounded-md border border-danger bg-surface-raised px-4 py-3 text-sm shadow-card"
    >
      <span>{ui.sync[MESSAGE[error]]}</span>
      <button
        type="button"
        onClick={dismissError}
        className="inline-flex min-h-11 items-center font-semibold underline"
      >
        {ui.sync.dismiss}
      </button>
    </div>
  );
}
