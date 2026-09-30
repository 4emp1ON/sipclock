import { z } from 'zod';

// Contract for user data sync (docs/adr/0006). Clients write through POST /v1/me/changes; the mobile app
// reads through PowerSync, the web through GET /v1/me/data.
//
// Conflict rule: last writer wins per row, ordered by the client clock `updated_at` (epoch ms). Each
// mutable table has exactly one mutable field, so row-level LWW is field-level LWW. The server clamps
// clocks that run ahead of its own, so a device with a wrong clock cannot win forever.

/** Tables clients may write. Row ids: ingredient id (bar_item), recipe id (favorite), UUID (drink_log). */
export const USER_TABLES = ['bar_item', 'favorite', 'drink_log'] as const;
export type UserTable = (typeof USER_TABLES)[number];

/** Upper bound for ops in one POST /v1/me/changes request. */
export const MAX_CHANGE_OPS = 500;
/** How far a client clock may run ahead of the server before it is clamped to server time. */
export const MAX_CLOCK_SKEW_MS = 5 * 60_000;

const epochMs = z.number().int().nonnegative();
const catalogId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/);

export const barItemDataSchema = z.object({ in_bar: z.boolean(), updated_at: epochMs });
export const favoriteDataSchema = z.object({ is_favorite: z.boolean(), updated_at: epochMs });
export const drinkLogDataSchema = z.object({ recipe_id: catalogId, made_at: epochMs });

/**
 * One change. `put` and `patch` are both upserts: PowerSync sends `patch` with only the changed columns,
 * so every write must include `updated_at` (bar_item, favorite) or the full row (drink_log).
 * Removing from the bar or favorites is a `put` with the flag false (a tombstone). A `delete` on
 * bar_item/favorite is accepted only with `data.updated_at` (the flag is then forced false); without it the
 * op cannot be ordered and is skipped. On drink_log `delete` removes the entry.
 */
export const changeOpSchema = z.discriminatedUnion('table', [
  z.object({
    table: z.literal('bar_item'),
    op: z.enum(['put', 'patch', 'delete']),
    id: catalogId,
    data: barItemDataSchema.optional(),
  }),
  z.object({
    table: z.literal('favorite'),
    op: z.enum(['put', 'patch', 'delete']),
    id: catalogId,
    data: favoriteDataSchema.optional(),
  }),
  z.object({
    table: z.literal('drink_log'),
    op: z.enum(['put', 'patch', 'delete']),
    id: z.uuid(),
    data: drinkLogDataSchema.optional(),
  }),
]);
export type ChangeOp = z.infer<typeof changeOpSchema>;

export const changeBatchSchema = z.object({
  ops: z.array(changeOpSchema).min(1).max(MAX_CHANGE_OPS),
});
export type ChangeBatch = z.infer<typeof changeBatchSchema>;

/** Response of POST /v1/me/changes. `skipped` = ops that lost LWW, referenced unknown catalog ids or had no data. */
export interface ChangeResult {
  applied: number;
  skipped: number;
}

export interface DrinkLogEntry {
  id: string;
  recipeId: string;
  /** Epoch ms. */
  madeAt: number;
}

/** Response of GET /v1/me/data: the signed-in user's current state (tombstones excluded). */
export interface UserDataSnapshot {
  bar: string[];
  favorites: string[];
  /** Newest first. */
  history: DrinkLogEntry[];
}
