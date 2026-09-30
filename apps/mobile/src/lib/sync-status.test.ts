import { type SyncInput, syncState } from './sync-status';

const base: SyncInput = {
  signedIn: true,
  online: true,
  connected: false,
  connecting: false,
  uploading: false,
  downloading: false,
  hasSynced: false,
  hasError: false,
};

describe('syncState', () => {
  it('reports guests regardless of connection', () => {
    expect(syncState({ ...base, signedIn: false, connected: true })).toBe('guest');
  });

  it('reports offline before anything else when the device has no network', () => {
    expect(syncState({ ...base, online: false, uploading: true })).toBe('offline');
    expect(syncState({ ...base, online: null, connected: true, hasSynced: true })).toBe('synced');
  });

  it('trusts a live sync connection over the OS reachability flag', () => {
    expect(syncState({ ...base, online: false, connected: true, hasSynced: true })).toBe('synced');
  });

  it('walks through connecting, syncing and synced', () => {
    expect(syncState({ ...base, connecting: true })).toBe('connecting');
    expect(syncState({ ...base, connected: true })).toBe('syncing');
    expect(syncState({ ...base, connected: true, downloading: true, hasSynced: true })).toBe(
      'syncing',
    );
    expect(syncState({ ...base, connected: true, hasSynced: true })).toBe('synced');
  });

  it('reports errors that are not masked by activity', () => {
    expect(syncState({ ...base, hasError: true })).toBe('error');
    expect(syncState({ ...base, hasError: true, uploading: true })).toBe('syncing');
  });
});
