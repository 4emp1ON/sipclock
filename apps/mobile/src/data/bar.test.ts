import { addToBar, listBar, removeFromBar, replaceBar } from './bar';
import { MIGRATIONS, migrate } from './db';
import { createFakeDb } from './fake-db.test-util';
import { loadRecent, pushRecent, saveRecent } from './kv';

describe('migrate', () => {
  it('applies migrations once and is idempotent', async () => {
    const fake = createFakeDb();
    await migrate(fake.db);
    expect(fake.userVersion).toBe(MIGRATIONS.length);
    const runs = fake.executed.length;
    await migrate(fake.db);
    expect(fake.executed.length).toBe(runs);
  });
});

describe('bar repository', () => {
  it('adds, lists in insertion order and ignores duplicates', async () => {
    const { db } = createFakeDb();
    await addToBar(db, 'gin', 1);
    await addToBar(db, 'lime', 2);
    await addToBar(db, 'gin', 3);
    expect(await listBar(db)).toEqual(['gin', 'lime']);
  });

  it('removes', async () => {
    const { db } = createFakeDb();
    await addToBar(db, 'gin', 1);
    await addToBar(db, 'lime', 2);
    await removeFromBar(db, 'gin');
    expect(await listBar(db)).toEqual(['lime']);
    await removeFromBar(db, 'unknown');
    expect(await listBar(db)).toEqual(['lime']);
  });

  it('replaces everything, dropping duplicates', async () => {
    const { db } = createFakeDb();
    await addToBar(db, 'gin', 1);
    await replaceBar(db, ['vodka', 'lemon', 'vodka'], 5);
    expect(await listBar(db)).toEqual(['lemon', 'vodka']);
    await replaceBar(db, []);
    expect(await listBar(db)).toEqual([]);
  });

  it('rolls back a failed replace', async () => {
    const fake = createFakeDb();
    await addToBar(fake.db, 'gin', 1);
    fake.failNextRun();
    await expect(replaceBar(fake.db, ['vodka'])).rejects.toThrow();
    expect(await listBar(fake.db)).toEqual(['gin']);
  });
});

describe('recent picks', () => {
  it('pushRecent puts newest first, dedupes and caps', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
    expect(pushRecent(['a', 'b'], 'c', 2)).toEqual(['c', 'a']);
  });

  it('round-trips through kv and tolerates garbage', async () => {
    const { db } = createFakeDb();
    expect(await loadRecent(db)).toEqual([]);
    await saveRecent(db, ['x', 'y']);
    expect(await loadRecent(db)).toEqual(['x', 'y']);
    await saveRecent(db, ['z']);
    expect(await loadRecent(db)).toEqual(['z']);
  });
});
