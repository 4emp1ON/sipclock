export type SyncState = 'guest' | 'offline' | 'connecting' | 'syncing' | 'synced' | 'error';

export interface SyncInput {
  signedIn: boolean;
  /** Device network state; null while unknown. */
  online: boolean | null;
  connected: boolean;
  connecting: boolean;
  uploading: boolean;
  downloading: boolean;
  hasSynced: boolean;
  hasError: boolean;
}

/** One word for the sync line on the account screen. */
export function syncState(s: SyncInput): SyncState {
  if (!s.signedIn) return 'guest';
  // A live sync connection outranks the OS flag: `isInternetReachable` is false on networks without an
  // outside route (an emulator, a LAN-only server) even though the sync server answers.
  if (s.online === false && !s.connected) return 'offline';
  if (s.uploading || s.downloading) return 'syncing';
  if (s.hasError) return 'error';
  if (s.connected) return s.hasSynced ? 'synced' : 'syncing';
  return 'connecting';
}
