import { listBar, replaceBar, setInBar, toggleBar } from './bar';
import { createFakeDb } from './fake-db.test-util';
import { listFavorites, setFavorite, toggleFavorite } from './favorites';
import { listHistory, logDrink } from './history';
import {
  deleteValue,
  getValue,
  loadRecent,
  mergeRecent,
  pushRecent,
  pushRecentPick,
  saveRecent,
  setValue,
} from './kv';

describe('bar repository', () => {
  it('adds, lists oldest first and ignores re-adding', async () => {
    const { db } = createFakeDb();
    await setInBar(db, 'gin', true, 1);
    await setInBar(db, 'lime', true, 2);
    expect(await listBar(db)).toEqual(['gin', 'lime']);
  });

  it('removes with a tombstone, never a delete', async () => {
    const fake = createFakeDb();
    await setInBar(fake.db, 'gin', true, 1);
    await setInBar(fake.db, 'gin', false, 2);
    expect(await listBar(fake.db)).toEqual([]);
    const crud = fake.crud();
    expect(crud.map((c) => c.op)).toEqual(['PUT', 'PUT']);
    expect(crud[1]).toEqual({
      op: 'PUT',
      table: 'bar_item',
      id: 'gin',
      data: { in_bar: 0, updated_at: 2 },
    });
  });

  it('never moves a row clock backwards, so a slow clock still wins over the last writer', async () => {
    const fake = createFakeDb();
    await setInBar(fake.db, 'gin', true, 5000); // e.g. synced from a device with a faster clock
    await setInBar(fake.db, 'gin', false, 1000);
    await setFavorite(fake.db, 'negroni', true, 5000);
    await setFavorite(fake.db, 'negroni', false, 5000);
    const data = fake.crud().map((c) => c.data);
    expect(data[1]).toEqual({ in_bar: 0, updated_at: 5001 });
    expect(data[3]).toEqual({ is_favorite: 0, updated_at: 5001 });
  });

  it('toggles in order, even when taps come faster than reads', async () => {
    const { db } = createFakeDb();
    await Promise.all([toggleBar(db, 'gin', 1), toggleBar(db, 'gin', 2), toggleBar(db, 'rum', 3)]);
    expect(await listBar(db)).toEqual(['rum']);
    expect(await toggleBar(db, 'gin', 4)).toBe(true);
    expect(await listBar(db)).toEqual(['rum', 'gin']);
  });

  it('replaces the bar, touching only rows that change', async () => {
    const fake = createFakeDb();
    await setInBar(fake.db, 'gin', true, 1);
    await setInBar(fake.db, 'lime', true, 2);
    const before = fake.crud().length;
    await replaceBar(fake.db, ['vodka', 'lime', 'vodka'], 5);
    expect(await listBar(fake.db)).toEqual(['lime', 'vodka']);
    expect(fake.crud().slice(before)).toEqual([
      { op: 'PUT', table: 'bar_item', id: 'gin', data: { in_bar: 0, updated_at: 5 } },
      { op: 'PUT', table: 'bar_item', id: 'vodka', data: { in_bar: 1, updated_at: 5 } },
    ]);
    await replaceBar(fake.db, [], 6);
    expect(await listBar(fake.db)).toEqual([]);
  });

  it('rolls back a failed replace', async () => {
    const fake = createFakeDb();
    await setInBar(fake.db, 'gin', true, 1);
    fake.failNextWrite();
    await expect(replaceBar(fake.db, ['vodka'])).rejects.toThrow();
    expect(await listBar(fake.db)).toEqual(['gin']);
  });
});

describe('favorites repository', () => {
  it('saves, lists newest first and unsaves with a tombstone', async () => {
    const fake = createFakeDb();
    await setFavorite(fake.db, 'negroni', true, 1);
    await setFavorite(fake.db, 'daiquiri', true, 2);
    expect(await listFavorites(fake.db)).toEqual(['daiquiri', 'negroni']);
    expect(await toggleFavorite(fake.db, 'negroni', 3)).toBe(false);
    expect(await listFavorites(fake.db)).toEqual(['daiquiri']);
    expect(fake.crud().every((c) => c.op === 'PUT')).toBe(true);
    expect(fake.crud().at(-1)?.data).toEqual({ is_favorite: 0, updated_at: 3 });
  });
});

describe('history repository', () => {
  it('logs drinks and lists newest first', async () => {
    const fake = createFakeDb();
    await logDrink(fake.db, { id: 'a', recipeId: 'negroni', madeAt: 10 });
    await logDrink(fake.db, { id: 'b', recipeId: 'daiquiri', madeAt: 20 });
    expect(await listHistory(fake.db)).toEqual([
      { id: 'b', recipeId: 'daiquiri', madeAt: 20 },
      { id: 'a', recipeId: 'negroni', madeAt: 10 },
    ]);
    expect(fake.crud()[0]).toEqual({
      op: 'PUT',
      table: 'drink_log',
      id: 'a',
      data: { recipe_id: 'negroni', made_at: 10 },
    });
  });
});

describe('kv and recent picks', () => {
  it('stores values locally without queueing uploads', async () => {
    const fake = createFakeDb();
    expect(await getValue(fake.db, 'k')).toBeNull();
    await setValue(fake.db, 'k', 'v1');
    await setValue(fake.db, 'k', 'v2');
    expect(await getValue(fake.db, 'k')).toBe('v2');
    await deleteValue(fake.db, 'k');
    expect(await getValue(fake.db, 'k')).toBeNull();
    expect(fake.crud()).toEqual([]);
  });

  it('mergeRecent keeps session picks in front of stored history', () => {
    expect(mergeRecent(['x'], ['a', 'x', 'b'])).toEqual(['x', 'a', 'b']);
    expect(mergeRecent([], ['a'])).toEqual(['a']);
  });

  it('pushRecent puts newest first, dedupes and caps', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
    expect(pushRecent(['a', 'b'], 'c', 2)).toEqual(['c', 'a']);
  });

  it('round-trips through kv and tolerates garbage', async () => {
    const { db } = createFakeDb();
    expect(await loadRecent(db)).toEqual([]);
    await saveRecent(db, ['x', 'y']);
    expect(await loadRecent(db)).toEqual(['x', 'y']);
    await setValue(db, 'recent_picks', '{not json');
    expect(await loadRecent(db)).toEqual([]);
  });

  it('pushRecentPick does not lose concurrent pushes', async () => {
    const { db } = createFakeDb();
    await Promise.all([pushRecentPick(db, 'a'), pushRecentPick(db, 'b')]);
    expect(await loadRecent(db)).toEqual(['b', 'a']);
  });
});
