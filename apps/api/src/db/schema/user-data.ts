import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth.ts';

// User data synced across devices (docs/adr/0006). Written only through POST /v1/me/changes; replicated
// to PowerSync through the `powersync` publication. `updated_at`/`made_at` are client clocks (epoch ms);
// `server_updated_at` records when the server last accepted a write.

export const barItem = pgTable(
  'bar_item',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ingredientId: text('ingredient_id').notNull(),
    inBar: boolean('in_bar').notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
    serverUpdatedAt: timestamp('server_updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.ingredientId] })],
);

export const favorite = pgTable(
  'favorite',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    recipeId: text('recipe_id').notNull(),
    isFavorite: boolean('is_favorite').notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
    serverUpdatedAt: timestamp('server_updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.recipeId] })],
);

export const drinkLog = pgTable(
  'drink_log',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    recipeId: text('recipe_id').notNull(),
    madeAt: bigint('made_at', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('drink_log_user_id_made_at_idx').on(t.userId, t.madeAt.desc())],
);

/** Stored responses of POST /v1/me/changes, so a retried request is answered without re-applying it. */
export const idempotencyKey = pgTable(
  'idempotency_key',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    response: jsonb('response').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);
