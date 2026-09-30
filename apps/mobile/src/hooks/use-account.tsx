import { PowerSyncContext, useStatus } from '@powersync/react-native';
import { useNetworkState } from 'expo-network';
import { type ReactNode, useEffect } from 'react';

import { powerSync, sessionSync } from '@/data/database';
import { authClient } from '@/lib/auth';
import { type SyncState, syncState } from '@/lib/sync-status';

const warn = (message: string) => (e: unknown) => console.warn(`[sync] ${message}`, e);

/** Keeps PowerSync connected while signed in (see src/data/session.ts). */
function SessionSync() {
  const { data, isPending, error } = authClient.useSession();
  const userId = data?.user.id ?? null;
  const failed = error != null;

  useEffect(() => {
    if (isPending) return;
    // A known user wins even when the refresh failed (a cached session): sync as that user, never as a
    // stale owner. Only an unknown session on a failed check resumes the device's owner.
    if (userId) sessionSync.setUser(userId).catch(warn('session change failed'));
    else if (failed) sessionSync.resume().catch(warn('resume failed'));
    else sessionSync.setUser(null).catch(warn('session change failed'));
  }, [isPending, failed, userId]);

  return null;
}

/** Provides the local database to `useQuery` and friends, and ties sync to the auth session. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  return (
    <PowerSyncContext.Provider value={powerSync}>
      <SessionSync />
      {children}
    </PowerSyncContext.Provider>
  );
}

export interface AccountUser {
  id: string;
  email: string;
}

/** The signed-in user, or null for guests. `pending` while the stored session is being read. */
export function useAccount(): { user: AccountUser | null; pending: boolean } {
  const { data, isPending } = authClient.useSession();
  const user = data?.user ? { id: data.user.id, email: data.user.email } : null;
  return { user, pending: isPending && !user };
}

/** Sync state for the status line, plus when the last full sync finished. */
export function useSyncStatus(): { state: SyncState; lastSyncedAt: Date | undefined } {
  const status = useStatus();
  const network = useNetworkState();
  const { user } = useAccount();
  const online =
    network.isConnected === undefined
      ? null
      : network.isConnected && network.isInternetReachable !== false;
  const state = syncState({
    signedIn: user !== null,
    online,
    connected: status.connected,
    connecting: status.connecting,
    uploading: status.dataFlowStatus.uploading,
    downloading: status.dataFlowStatus.downloading,
    hasSynced: status.hasSynced === true,
    hasError: Boolean(status.dataFlowStatus.uploadError ?? status.dataFlowStatus.downloadError),
  });
  return { state, lastSyncedAt: status.lastSyncedAt };
}

export class AccountError extends Error {
  constructor(
    readonly code: string | undefined,
    readonly status: number | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'AccountError';
  }
}

type AuthResult = { error: { code?: string; status?: number; message?: string } | null };

function check({ error }: AuthResult) {
  if (error) throw new AccountError(error.code, error.status, error.message ?? 'Request failed');
}

/** Changes made on this device that have not reached the server yet (lost on sign-out). */
export async function pendingUploads(): Promise<number> {
  return (await powerSync.getUploadQueueStats()).count;
}

/** Sign out on the server, then wipe this account's data from the device (local-only kv stays). */
export async function signOut(): Promise<void> {
  check(await authClient.signOut());
  await sessionSync.wipe();
}

/** Delete the account and its data on the server, then wipe it from the device. */
export async function deleteAccount(): Promise<void> {
  check(await authClient.deleteUser());
  await sessionSync.wipe();
}

/**
 * Better Auth only deletes accounts from a session younger than a day (`SESSION_EXPIRED` otherwise). Code-only
 * users have no password, so they confirm with a fresh sign-in code instead.
 */
export const needsFreshSession = (e: unknown) =>
  e instanceof AccountError && e.code === 'SESSION_EXPIRED';

export async function sendSignInCode(email: string): Promise<void> {
  check(await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' }));
}

/** Sign in again with the emailed code (same account, fresh session), then delete. */
export async function deleteAccountWithCode(email: string, otp: string): Promise<void> {
  check(await authClient.signIn.emailOtp({ email, otp }));
  await deleteAccount();
}
