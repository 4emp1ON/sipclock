import { createFakeDb } from './fake-db.test-util';
import { getValue } from './kv';
import { createSessionSync, SYNC_USER_KEY } from './session';

function setup() {
  const { db } = createFakeDb();
  const calls: string[] = [];
  const target = {
    connect: async () => {
      calls.push('connect');
    },
    disconnect: async () => {
      calls.push('disconnect');
    },
    clear: async () => {
      calls.push('clear');
    },
  };
  return { db, calls, sync: createSessionSync(db, target) };
}

describe('session sync', () => {
  it('stays disconnected for guests', async () => {
    const { calls, sync } = setup();
    await sync.setUser(null);
    await sync.resume();
    expect(calls).toEqual(['disconnect']);
  });

  it('connects on sign-in without clearing, so queued guest writes upload to the account', async () => {
    const { db, calls, sync } = setup();
    await sync.setUser('u1');
    await sync.setUser('u1');
    expect(calls).toEqual(['connect']);
    expect(await getValue(db, SYNC_USER_KEY)).toBe('u1');
  });

  it('wipes on explicit sign-out and forgets the owner', async () => {
    const { db, calls, sync } = setup();
    await sync.setUser('u1');
    await sync.wipe();
    expect(calls).toEqual(['connect', 'clear']);
    expect(await getValue(db, SYNC_USER_KEY)).toBeNull();
  });

  it('keeps the queue when a session just ends, and uploads it when the same account returns', async () => {
    const { db, calls, sync } = setup();
    await sync.setUser('u1');
    // e.g. the session expired while the device was offline
    await sync.setUser(null);
    expect(await getValue(db, SYNC_USER_KEY)).toBe('u1');
    await sync.setUser('u1');
    expect(calls).toEqual(['connect', 'disconnect', 'connect']);
  });

  it('clears before connecting a different account', async () => {
    const { db, calls, sync } = setup();
    await sync.setUser('u1');
    // e.g. the app restarted with a new session for another account
    const restarted = createSessionSync(db, {
      connect: async () => void calls.push('connect'),
      disconnect: async () => void calls.push('disconnect'),
      clear: async () => void calls.push('clear'),
    });
    await restarted.setUser('u2');
    expect(calls).toEqual(['connect', 'clear', 'connect']);
    expect(await getValue(db, SYNC_USER_KEY)).toBe('u2');
  });

  it('resumes syncing for the stored owner when the session cannot be checked', async () => {
    const { db, calls, sync } = setup();
    await sync.setUser('u1');
    const offline = createSessionSync(db, {
      connect: async () => void calls.push('connect'),
      disconnect: async () => void calls.push('disconnect'),
      clear: async () => void calls.push('clear'),
    });
    await offline.resume();
    await offline.setUser('u1');
    expect(calls).toEqual(['connect', 'connect']);
  });

  it('serializes overlapping calls', async () => {
    const { calls, sync } = setup();
    await Promise.all([sync.setUser('u1'), sync.setUser(null), sync.setUser('u2')]);
    expect(calls).toEqual(['connect', 'disconnect', 'clear', 'connect']);
  });
});
