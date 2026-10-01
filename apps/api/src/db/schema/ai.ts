import {
  bigint,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { user } from './auth.ts';

// AI gateway state (docs/adr/0007). Server-only: not replicated to PowerSync. Prompts and answers about a
// user are never stored; the cache holds only answers derived from catalog ids.

/** Per-user AI settings. `ru_pinned_at` is sticky: once set, the user is served by the Russian provider. */
export const aiProfile = pgTable('ai_profile', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  plan: text('plan').notNull().default('free'),
  ruPinnedAt: timestamp('ru_pinned_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Requests and tokens per user per UTC day; `requests` is reserved before a model call. */
export const aiUsageDaily = pgTable(
  'ai_usage_daily',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    requests: integer('requests').notNull().default(0),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

/**
 * Spend per provider per calendar month in millionths of the provider's billing currency. A call reserves
 * its worst-case cost first and settles the actual cost after, so concurrent calls cannot overshoot.
 */
export const aiSpendMonthly = pgTable(
  'ai_spend_monthly',
  {
    provider: text('provider').notNull(),
    month: date('month', { mode: 'string' }).notNull(),
    reservedMicros: bigint('reserved_micros', { mode: 'number' }).notNull().default(0),
    spentMicros: bigint('spent_micros', { mode: 'number' }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.provider, t.month] })],
);

/** Answers keyed by a hash of server-validated inputs (catalog ids, locale, prompt version). */
export const aiCache = pgTable('ai_cache', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
