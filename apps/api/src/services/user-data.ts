import type {
  ChangeBatch,
  ChangeOp,
  ChangeResult,
  DrinkLogEntry,
  UserDataSnapshot,
} from '@sipclock/domain';
import { MAX_CLOCK_SKEW_MS } from '@sipclock/domain';
import { and, asc, desc, eq, lt, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { barItem, drinkLog, favorite, idempotencyKey } from '../db/schema/user-data.ts';
import type { CatalogService } from './catalog.ts';

/** Stored idempotent responses are kept this long. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000;
/** Upper bound for `history` in GET /v1/me/data. */
export const HISTORY_LIMIT = 200;

export interface UserDataService {
  /**
   * Applies a batch atomically, or returns the stored result when `(userId, key)` was already used.
   * Ops that lose last-writer-wins, reference unknown catalog ids or lack data are counted as skipped.
   */
  applyChanges(userId: string, key: string, batch: ChangeBatch): Promise<ChangeResult>;
  snapshot(userId: string): Promise<UserDataSnapshot>;
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Client clocks further ahead than the allowed skew are replaced by server time. `order` is the op's position
 * in its batch: clamped ops stay in the order the client made them, so the later of two edits to one row
 * (both clamped) still wins instead of tying.
 */
export function clampClock(clientMs: number, serverNow: number, order = 0): number {
  return clientMs > serverNow + MAX_CLOCK_SKEW_MS ? serverNow + order : clientMs;
}

export function createUserDataService(
  db: Database,
  catalog: CatalogService,
  now: () => number = Date.now,
): UserDataService {
  const ingredientIds = new Set(catalog.catalog.ingredients.map((i) => i.id));
  const recipeIds = new Set(catalog.catalog.recipes.map((r) => r.id));

  /** Returns true when the op changed a row. */
  async function applyOp(tx: Tx, userId: string, op: ChangeOp, serverNow: number, order: number) {
    switch (op.table) {
      case 'bar_item': {
        if (!ingredientIds.has(op.id)) return false;
        // A delete is a tombstone at the client's clock; without one it cannot be ordered and is skipped.
        const value = op.data && {
          inBar: op.op === 'delete' ? false : op.data.in_bar,
          updatedAt: clampClock(op.data.updated_at, serverNow, order),
        };
        if (!value) return false;
        const rows = await tx
          .insert(barItem)
          .values({ userId, ingredientId: op.id, ...value })
          .onConflictDoUpdate({
            target: [barItem.userId, barItem.ingredientId],
            set: {
              inBar: sql`excluded.in_bar`,
              updatedAt: sql`excluded.updated_at`,
              serverUpdatedAt: sql`now()`,
            },
            // Strictly newer wins; a tie keeps the stored row, so replays are no-ops.
            setWhere: sql`excluded.updated_at > ${barItem.updatedAt}`,
          })
          .returning({ id: barItem.ingredientId });
        return rows.length > 0;
      }
      case 'favorite': {
        if (!recipeIds.has(op.id)) return false;
        const value = op.data && {
          isFavorite: op.op === 'delete' ? false : op.data.is_favorite,
          updatedAt: clampClock(op.data.updated_at, serverNow, order),
        };
        if (!value) return false;
        const rows = await tx
          .insert(favorite)
          .values({ userId, recipeId: op.id, ...value })
          .onConflictDoUpdate({
            target: [favorite.userId, favorite.recipeId],
            set: {
              isFavorite: sql`excluded.is_favorite`,
              updatedAt: sql`excluded.updated_at`,
              serverUpdatedAt: sql`now()`,
            },
            setWhere: sql`excluded.updated_at > ${favorite.updatedAt}`,
          })
          .returning({ id: favorite.recipeId });
        return rows.length > 0;
      }
      case 'drink_log': {
        if (op.op === 'delete') {
          const rows = await tx
            .delete(drinkLog)
            .where(and(eq(drinkLog.id, op.id), eq(drinkLog.userId, userId)))
            .returning({ id: drinkLog.id });
          return rows.length > 0;
        }
        if (!op.data || !recipeIds.has(op.data.recipe_id)) return false;
        // Entries are immutable; an id that already exists (for this or another user) is left alone.
        const rows = await tx
          .insert(drinkLog)
          .values({
            id: op.id,
            userId,
            recipeId: op.data.recipe_id,
            madeAt: clampClock(op.data.made_at, serverNow, order),
          })
          .onConflictDoNothing({ target: drinkLog.id })
          .returning({ id: drinkLog.id });
        return rows.length > 0;
      }
    }
  }

  return {
    async applyChanges(userId, key, batch) {
      return db.transaction(async (tx) => {
        const serverNow = now();
        await tx
          .delete(idempotencyKey)
          .where(
            and(
              eq(idempotencyKey.userId, userId),
              lt(idempotencyKey.createdAt, new Date(serverNow - IDEMPOTENCY_TTL_MS)),
            ),
          );
        // Claim the key first: a concurrent request with the same key blocks here until this
        // transaction ends, then finds the stored response instead of applying the batch twice.
        const claimed = await tx
          .insert(idempotencyKey)
          .values({ userId, key, response: { applied: 0, skipped: 0 } })
          .onConflictDoNothing()
          .returning({ key: idempotencyKey.key });
        if (claimed.length === 0) {
          const [stored] = await tx
            .select({ response: idempotencyKey.response })
            .from(idempotencyKey)
            .where(and(eq(idempotencyKey.userId, userId), eq(idempotencyKey.key, key)));
          return stored?.response as ChangeResult;
        }

        let applied = 0;
        // Row locks in a fixed order, so concurrent batches of one user cannot deadlock. The sort is
        // stable: ops on the same row keep their order.
        const ops = batch.ops
          .map((op, order) => ({ op, order }))
          .toSorted(({ op: a }, { op: b }) =>
            a.table === b.table
              ? a.id < b.id
                ? -1
                : a.id > b.id
                  ? 1
                  : 0
              : a.table < b.table
                ? -1
                : 1,
          );
        for (const { op, order } of ops) {
          if (await applyOp(tx, userId, op, serverNow, order)) applied++;
        }
        const result: ChangeResult = { applied, skipped: batch.ops.length - applied };
        await tx
          .update(idempotencyKey)
          .set({ response: result })
          .where(and(eq(idempotencyKey.userId, userId), eq(idempotencyKey.key, key)));
        return result;
      });
    },

    async snapshot(userId) {
      const [bar, favorites, history] = await Promise.all([
        db
          .select({ id: barItem.ingredientId })
          .from(barItem)
          .where(and(eq(barItem.userId, userId), eq(barItem.inBar, true)))
          .orderBy(asc(barItem.updatedAt), asc(barItem.ingredientId)),
        db
          .select({ id: favorite.recipeId })
          .from(favorite)
          .where(and(eq(favorite.userId, userId), eq(favorite.isFavorite, true)))
          .orderBy(asc(favorite.updatedAt), asc(favorite.recipeId)),
        db
          .select({ id: drinkLog.id, recipeId: drinkLog.recipeId, madeAt: drinkLog.madeAt })
          .from(drinkLog)
          .where(eq(drinkLog.userId, userId))
          .orderBy(desc(drinkLog.madeAt), desc(drinkLog.id))
          .limit(HISTORY_LIMIT),
      ]);
      return {
        bar: bar.map((r) => r.id),
        favorites: favorites.map((r) => r.id),
        history: history satisfies DrinkLogEntry[],
      };
    },
  };
}
