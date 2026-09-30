import type { Db } from './db';
import { deleteValue, getValue, setValue } from './kv';

/** kv key holding the account whose data the local synced tables belong to. */
export const SYNC_USER_KEY = 'sync_user';

export interface SyncTarget {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Disconnect and wipe synced tables and the upload queue (local-only kv stays). */
  clear(): Promise<void>;
}

/**
 * Keeps PowerSync in step with the auth session. Calls are serialized, so a sign-out racing a session refresh
 * cannot interleave a clear with a connect.
 *
 * - Guest (never signed in on this device, or signed out): not connected. Writes stay in PowerSync's upload
 *   queue on the device.
 * - Sign-in: connect. The queued guest writes upload to the account first (PowerSync applies downloaded data
 *   only once the queue is empty), so guest data merges into the account by the server's last-writer-wins rule.
 * - A different account than the one the local data belongs to: clear first, so one account's data is never
 *   uploaded to or shown in another.
 * - Explicit sign-out or account deletion (`wipe`): clear. Local-only kv is kept.
 * - A session that simply ended (expired, revoked, the server no longer accepts it): disconnect only. The
 *   owner and the upload queue stay, so changes made meanwhile upload once the same account signs in again;
 *   another account signing in clears them (see above).
 */
export function createSessionSync(db: Db, target: SyncTarget) {
  let chain: Promise<void> = Promise.resolve();
  let connectedAs: string | null = null;

  const run = (task: () => Promise<void>) => {
    const next = chain.then(task);
    chain = next.catch(() => undefined);
    return next;
  };

  return {
    /**
     * The session resolved: `userId` is the signed-in user, or null when there is none. Null never wipes
     * data: a session can end without the user asking (expiry), and the queue may hold unsynced changes.
     */
    setUser(userId: string | null): Promise<void> {
      return run(async () => {
        const owner = await getValue(db, SYNC_USER_KEY);
        if (userId) {
          if (connectedAs === userId) return;
          if (owner && owner !== userId) await target.clear();
          if (owner !== userId) await setValue(db, SYNC_USER_KEY, userId);
          await target.connect();
          connectedAs = userId;
        } else {
          connectedAs = null;
          await target.disconnect();
        }
      });
    },

    /** Explicit sign-out or account deletion: wipe this account's data and upload queue from the device. */
    wipe(): Promise<void> {
      return run(async () => {
        connectedAs = null;
        await target.clear();
        await deleteValue(db, SYNC_USER_KEY);
      });
    },

    /**
     * The session could not be checked (offline launch). Keep syncing for the account the data belongs to;
     * PowerSync retries until the network is back, and a 401 later routes through `setUser(null)`
     * (a disconnect that keeps the queue).
     */
    resume(): Promise<void> {
      return run(async () => {
        const owner = await getValue(db, SYNC_USER_KEY);
        if (!owner || connectedAs === owner) return;
        await target.connect();
        connectedAs = owner;
      });
    },
  };
}

export type SessionSync = ReturnType<typeof createSessionSync>;
