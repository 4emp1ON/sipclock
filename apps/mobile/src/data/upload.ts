import { type ChangeOp, changeOpSchema, USER_TABLES, type UserTable } from '@sipclock/domain';

/** The fields of PowerSync's `CrudEntry` that the mapping reads (kept structural so tests need no runtime). */
export interface CrudEntryLike {
  clientId: number;
  id: string;
  op: 'PUT' | 'PATCH' | 'DELETE' | string;
  table: string;
  opData?: Record<string, unknown>;
}

const OPS = { PUT: 'put', PATCH: 'patch', DELETE: 'delete' } as const;

/** Columns per table and whether SQLite's 0/1 integer is a boolean in the contract. */
const COLUMNS: Record<UserTable, Record<string, 'boolean' | 'number' | 'string'>> = {
  bar_item: { in_bar: 'boolean', updated_at: 'number' },
  favorite: { is_favorite: 'boolean', updated_at: 'number' },
  drink_log: { recipe_id: 'string', made_at: 'number' },
};

function convert(kind: 'boolean' | 'number' | 'string', value: unknown): unknown {
  if (kind === 'boolean') return value === 1 || value === true || value === '1';
  if (kind === 'number') return typeof value === 'string' ? Number(value) : value;
  return value;
}

export interface MappedBatch {
  ops: ChangeOp[];
  /** Entries that cannot be expressed in the contract (unknown table, incomplete PATCH, bad id). */
  rejected: { entry: CrudEntryLike; reason: string }[];
}

/**
 * Map PowerSync upload-queue entries to `ChangeOp`s (packages/domain/src/user-data.ts).
 *
 * - `PUT`/`PATCH`/`DELETE` become `put`/`patch`/`delete`.
 * - `opData` becomes `data` with integer flags turned into booleans. Tombstones are ordinary puts with the
 *   flag false (the repositories never DELETE bar_item/favorite rows).
 * - Entries the server would reject (e.g. a PATCH that carries only some columns) are returned in `rejected`
 *   instead of failing the whole request; the repositories always write full rows, so this is a safety net.
 */
export function mapCrudEntries(entries: readonly CrudEntryLike[]): MappedBatch {
  const ops: ChangeOp[] = [];
  const rejected: MappedBatch['rejected'] = [];
  for (const entry of entries) {
    if (!(USER_TABLES as readonly string[]).includes(entry.table)) {
      rejected.push({ entry, reason: `unknown table ${entry.table}` });
      continue;
    }
    const table = entry.table as UserTable;
    const op = OPS[entry.op as keyof typeof OPS];
    if (!op) {
      rejected.push({ entry, reason: `unknown op ${entry.op}` });
      continue;
    }
    // A bare delete has no clock, so the server cannot order it against other devices and skips it.
    // Removals are tombstone puts; a DELETE here would mean a raw SQL delete slipped past the repositories.
    if (op === 'delete' && table !== 'drink_log') {
      rejected.push({ entry, reason: `${table} rows are removed with tombstones, not deletes` });
      continue;
    }
    const candidate: Record<string, unknown> = { table, op, id: entry.id };
    if (op !== 'delete') {
      const data: Record<string, unknown> = {};
      for (const [column, kind] of Object.entries(COLUMNS[table])) {
        const value = entry.opData?.[column];
        if (value !== undefined && value !== null) data[column] = convert(kind, value);
      }
      candidate.data = data;
    }
    const parsed = changeOpSchema.safeParse(candidate);
    if (parsed.success) ops.push(parsed.data);
    else rejected.push({ entry, reason: parsed.error.issues[0]?.message ?? 'invalid' });
  }
  return { ops, rejected };
}

/** 53-bit string hash (cyrb53): enough to tell two request bodies apart, not a security primitive. */
export function hashString(input: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * `Idempotency-Key` for one upload batch: the PowerSync client id of this database, the range of upload-queue
 * ids in the batch and a hash of the request body. A retry of the same batch yields the same key; a different
 * batch (more entries queued meanwhile, or queue ids reused after the database was recreated) yields a new one.
 */
export function idempotencyKey(
  clientId: string,
  entries: readonly Pick<CrudEntryLike, 'clientId'>[],
  body: string,
): string {
  const first = entries[0]?.clientId ?? 0;
  const last = entries.at(-1)?.clientId ?? 0;
  return `${clientId}:${first}-${last}:${hashString(body)}`;
}
