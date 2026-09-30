import { createConnector, isPermanentFailure, type UploadSource } from './connector';
import { type CrudEntryLike, hashString, idempotencyKey, mapCrudEntries } from './upload';

const UUID = '0b8f2a6e-3c4d-4e5f-8a9b-1c2d3e4f5a6b';

const entry = (e: Partial<CrudEntryLike> & Pick<CrudEntryLike, 'table' | 'id'>): CrudEntryLike => ({
  clientId: 1,
  op: 'PUT',
  ...e,
});

describe('mapCrudEntries', () => {
  it('maps puts and converts integer flags to booleans', () => {
    const { ops, rejected } = mapCrudEntries([
      entry({ table: 'bar_item', id: 'gin', opData: { in_bar: 1, updated_at: 10 } }),
      entry({ table: 'favorite', id: 'negroni', opData: { is_favorite: 1, updated_at: 11 } }),
    ]);
    expect(rejected).toEqual([]);
    expect(ops).toEqual([
      { table: 'bar_item', op: 'put', id: 'gin', data: { in_bar: true, updated_at: 10 } },
      { table: 'favorite', op: 'put', id: 'negroni', data: { is_favorite: true, updated_at: 11 } },
    ]);
  });

  it('keeps tombstones as puts with the flag false', () => {
    const { ops } = mapCrudEntries([
      entry({ table: 'bar_item', id: 'gin', opData: { in_bar: 0, updated_at: 12 } }),
      entry({ table: 'favorite', id: 'negroni', opData: { is_favorite: 0, updated_at: 13 } }),
    ]);
    expect(ops).toEqual([
      { table: 'bar_item', op: 'put', id: 'gin', data: { in_bar: false, updated_at: 12 } },
      { table: 'favorite', op: 'put', id: 'negroni', data: { is_favorite: false, updated_at: 13 } },
    ]);
  });

  it('maps drink_log rows', () => {
    const { ops } = mapCrudEntries([
      entry({ table: 'drink_log', id: UUID, opData: { recipe_id: 'daiquiri', made_at: 99 } }),
    ]);
    expect(ops).toEqual([
      { table: 'drink_log', op: 'put', id: UUID, data: { recipe_id: 'daiquiri', made_at: 99 } },
    ]);
  });

  it('maps full patches and deletes', () => {
    const { ops } = mapCrudEntries([
      entry({ table: 'bar_item', id: 'gin', op: 'PATCH', opData: { in_bar: 1, updated_at: 5 } }),
      entry({ table: 'drink_log', id: UUID, op: 'DELETE' }),
    ]);
    expect(ops).toEqual([
      { table: 'bar_item', op: 'patch', id: 'gin', data: { in_bar: true, updated_at: 5 } },
      { table: 'drink_log', op: 'delete', id: UUID },
    ]);
  });

  it('never uploads bare deletes for tombstoned tables', () => {
    const { ops, rejected } = mapCrudEntries([
      entry({ table: 'bar_item', id: 'gin', op: 'DELETE' }),
      entry({ table: 'favorite', id: 'negroni', op: 'DELETE' }),
    ]);
    expect(ops).toEqual([]);
    expect(rejected.map((r) => r.entry.id)).toEqual(['gin', 'negroni']);
  });

  it('rejects what the server would refuse instead of failing the batch', () => {
    const { ops, rejected } = mapCrudEntries([
      entry({ table: 'bar_item', id: 'gin', op: 'PATCH', opData: { updated_at: 5 } }),
      entry({ table: 'kv', id: 'recent_picks', opData: { value: '[]' } }),
      entry({ table: 'drink_log', id: 'not-a-uuid', opData: { recipe_id: 'x', made_at: 1 } }),
      entry({ table: 'bar_item', id: 'Bad Id', opData: { in_bar: 1, updated_at: 1 } }),
      entry({ table: 'bar_item', id: 'ok', opData: { in_bar: 1, updated_at: 1 } }),
    ]);
    expect(ops.map((o) => o.id)).toEqual(['ok']);
    expect(rejected.map((r) => r.entry.id)).toEqual([
      'gin',
      'recent_picks',
      'not-a-uuid',
      'Bad Id',
    ]);
  });
});

describe('idempotencyKey', () => {
  const entries = [{ clientId: 7 }, { clientId: 8 }, { clientId: 12 }];

  it('is stable for a retry of the same batch', () => {
    expect(idempotencyKey('client', entries, '{"ops":[1]}')).toBe(
      idempotencyKey('client', [...entries], '{"ops":[1]}'),
    );
    expect(idempotencyKey('client', entries, 'b')).toMatch(/^client:7-12:[0-9a-z]+$/);
  });

  it('changes with the range, the body or the database', () => {
    const base = idempotencyKey('client', entries, 'body');
    expect(idempotencyKey('client', entries.slice(0, 2), 'body')).not.toBe(base);
    expect(idempotencyKey('client', entries, 'other body')).not.toBe(base);
    expect(idempotencyKey('other', entries, 'body')).not.toBe(base);
  });

  it('hashString is deterministic and spreads', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });
});

describe('isPermanentFailure', () => {
  it('drops a batch only on contract rejections and retries everything else', () => {
    expect([400, 413, 415, 422].map(isPermanentFailure)).toEqual([true, true, true, true]);
    // 403/404/405 can come from a proxy or a maintenance page: dropping would lose user data.
    expect([401, 403, 404, 405, 408, 409, 429, 500, 503].every((s) => !isPermanentFailure(s))).toBe(
      true,
    );
  });
});

function queue(batches: CrudEntryLike[][]) {
  const completed: number[] = [];
  let index = 0;
  const source: UploadSource = {
    async getCrudBatch() {
      const crud = batches[index];
      if (!crud) return null;
      const at = index;
      return {
        crud,
        haveMore: at < batches.length - 1,
        complete: async () => {
          completed.push(at);
          index = at + 1;
        },
      };
    },
    getClientId: async () => 'db-1',
  };
  return { source, completed };
}

const response = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('connector', () => {
  const bar = (id: string, clientId: number) =>
    entry({ table: 'bar_item', id, clientId, opData: { in_bar: 1, updated_at: 1 } });

  const header = (init: RequestInit | undefined, name: string) =>
    (init?.headers as Record<string, string> | undefined)?.[name];

  function setup(statuses: number[], cookie = 'sid=1') {
    const calls: { url: string; init: RequestInit }[] = [];
    const onUnauthorized = jest.fn();
    const connector = createConnector({
      apiUrl: 'https://api.test/sipclock',
      powersyncUrl: 'https://api.test/sipclock/powersync',
      getCookie: async () => cookie,
      fetch: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        const status = statuses.shift() ?? 200;
        return url.endsWith('/api/auth/token')
          ? response(status, { token: 'jwt' })
          : response(status);
      }) as unknown as typeof fetch,
      onUnauthorized,
      log: () => undefined,
    });
    return { connector, calls, onUnauthorized };
  }

  it('fetches credentials with the session cookie', async () => {
    const { connector, calls } = setup([200]);
    await expect(connector.fetchCredentials()).resolves.toEqual({
      endpoint: 'https://api.test/sipclock/powersync',
      token: 'jwt',
    });
    expect(calls[0]?.url).toBe('https://api.test/sipclock/api/auth/token');
    expect(calls[0]?.init.credentials).toBe('omit');
    expect(header(calls[0]?.init, 'Cookie')).toBe('sid=1');
  });

  it('returns null credentials when signed out or the session is gone', async () => {
    await expect(setup([], '').connector.fetchCredentials()).resolves.toBeNull();
    const expired = setup([401]);
    await expect(expired.connector.fetchCredentials()).resolves.toBeNull();
    expect(expired.onUnauthorized).toHaveBeenCalled();
    await expect(setup([503]).connector.fetchCredentials()).rejects.toThrow('503');
  });

  it('uploads every batch with a stable idempotency key, then completes it', async () => {
    const { connector, calls } = setup([200, 200]);
    const q = queue([[bar('gin', 1), bar('lime', 2)], [bar('rum', 3)]]);
    await connector.uploadData(q.source);
    expect(q.completed).toEqual([0, 1]);
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.test/sipclock/v1/me/changes',
      'https://api.test/sipclock/v1/me/changes',
    ]);
    const first = calls[0]?.init;
    expect(JSON.parse(first?.body as string).ops).toHaveLength(2);
    expect(header(first, 'Idempotency-Key')).toMatch(/^db-1:1-2:/);
    expect(header(first, 'Cookie')).toBe('sid=1');
  });

  it('reuses the key when a failed batch is retried', async () => {
    const { connector, calls } = setup([500, 200]);
    const q = queue([[bar('gin', 1)]]);
    await expect(connector.uploadData(q.source)).rejects.toThrow('500');
    expect(q.completed).toEqual([]);
    await connector.uploadData(q.source);
    expect(q.completed).toEqual([0]);
    const key = (i: number) => header(calls[i]?.init, 'Idempotency-Key');
    expect(key(0)).toBe(key(1));
  });

  it('skips a batch the server rejects as invalid so the queue keeps moving', async () => {
    const { connector } = setup([400, 200]);
    const q = queue([[bar('gin', 1)], [bar('rum', 2)]]);
    await connector.uploadData(q.source);
    expect(q.completed).toEqual([0, 1]);
  });

  it('keeps the queue on 401 and reports the lost session', async () => {
    const { connector, onUnauthorized } = setup([401]);
    const q = queue([[bar('gin', 1)]]);
    await expect(connector.uploadData(q.source)).rejects.toThrow('session expired');
    expect(q.completed).toEqual([]);
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it('completes batches that contain nothing uploadable without calling the API', async () => {
    const { connector, calls } = setup([]);
    const q = queue([[entry({ table: 'kv', id: 'x', opData: { value: '1' } })]]);
    await connector.uploadData(q.source);
    expect(q.completed).toEqual([0]);
    expect(calls).toEqual([]);
  });
});
