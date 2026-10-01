import { and, eq, gt, sql } from 'drizzle-orm';
import type { Database } from '../db/client.ts';
import { aiCache, aiProfile, aiUsageDaily } from '../db/schema/ai.ts';
import type { Provider } from './region.ts';

export interface AiProfile {
  plan: string;
  pinned: boolean;
}

/** Persistence of the AI gateway: profiles, quotas, spend and the answer cache. */
export interface AiStore {
  profile(userId: string): Promise<AiProfile>;
  /** Pins the user to the Russian provider; idempotent. */
  pin(userId: string): Promise<void>;
  /**
   * Counts one request against today's quota if it is below `limit`. Returns the requests left after it, or
   * `null` when the quota is exhausted (nothing is counted then).
   */
  reserveRequest(userId: string, day: string, limit: number): Promise<number | null>;
  /** Gives back a reserved request (the call failed before reaching the model). */
  releaseRequest(userId: string, day: string): Promise<void>;
  addTokens(userId: string, day: string, input: number, output: number): Promise<void>;
  /** Reserves `micros` of this month's budget if it fits; `false` when it would exceed `budget`. */
  reserveSpend(provider: Provider, month: string, micros: number, budget: number): Promise<boolean>;
  /** Replaces a reservation with the actual cost. */
  settleSpend(provider: Provider, month: string, reserved: number, actual: number): Promise<void>;
  cacheGet(key: string, maxAgeMs: number): Promise<unknown | undefined>;
  cachePut(key: string, value: unknown): Promise<void>;
}

export function createAiStore(db: Database): AiStore {
  return {
    async profile(userId) {
      const [row] = await db
        .select({ plan: aiProfile.plan, ruPinnedAt: aiProfile.ruPinnedAt })
        .from(aiProfile)
        .where(eq(aiProfile.userId, userId));
      return { plan: row?.plan ?? 'free', pinned: row?.ruPinnedAt != null };
    },

    async pin(userId) {
      await db
        .insert(aiProfile)
        .values({ userId, ruPinnedAt: new Date() })
        .onConflictDoUpdate({
          target: aiProfile.userId,
          set: { ruPinnedAt: sql`coalesce(${aiProfile.ruPinnedAt}, now())` },
        });
    },

    async reserveRequest(userId, day, limit) {
      if (limit <= 0) return null;
      // One statement, so concurrent requests cannot both pass the check.
      const rows = await db
        .insert(aiUsageDaily)
        .values({ userId, day, requests: 1 })
        .onConflictDoUpdate({
          target: [aiUsageDaily.userId, aiUsageDaily.day],
          set: { requests: sql`${aiUsageDaily.requests} + 1` },
          setWhere: sql`${aiUsageDaily.requests} < ${limit}`,
        })
        .returning({ requests: aiUsageDaily.requests });
      const used = rows[0]?.requests;
      return used === undefined ? null : limit - used;
    },

    async releaseRequest(userId, day) {
      await db
        .update(aiUsageDaily)
        .set({ requests: sql`greatest(${aiUsageDaily.requests} - 1, 0)` })
        .where(and(eq(aiUsageDaily.userId, userId), eq(aiUsageDaily.day, day)));
    },

    async addTokens(userId, day, input, output) {
      await db
        .update(aiUsageDaily)
        .set({
          inputTokens: sql`${aiUsageDaily.inputTokens} + ${input}`,
          outputTokens: sql`${aiUsageDaily.outputTokens} + ${output}`,
        })
        .where(and(eq(aiUsageDaily.userId, userId), eq(aiUsageDaily.day, day)));
    },

    async reserveSpend(provider, month, micros, budget) {
      // Explicit casts: untyped parameters would be compared as text ('600' <= '1000' is false).
      const rows = await db.execute(sql`
        insert into ai_spend_monthly (provider, month, reserved_micros)
        select ${provider}, ${month}::date, ${micros}::bigint where ${micros}::bigint <= ${budget}::bigint
        on conflict (provider, month) do update
          set reserved_micros = ai_spend_monthly.reserved_micros + excluded.reserved_micros
          where ai_spend_monthly.reserved_micros + ai_spend_monthly.spent_micros
            + excluded.reserved_micros <= ${budget}::bigint
        returning 1
      `);
      return rows.length > 0;
    },

    async settleSpend(provider, month, reserved, actual) {
      await db.execute(sql`
        update ai_spend_monthly
        set reserved_micros = greatest(reserved_micros - ${reserved}, 0),
            spent_micros = spent_micros + ${actual}
        where provider = ${provider} and month = ${month}
      `);
    },

    async cacheGet(key, maxAgeMs) {
      const [row] = await db
        .select({ value: aiCache.value })
        .from(aiCache)
        .where(
          and(
            eq(aiCache.key, key),
            gt(aiCache.createdAt, sql`now() - make_interval(secs => ${maxAgeMs / 1000})`),
          ),
        );
      return row?.value;
    },

    async cachePut(key, value) {
      await db
        .insert(aiCache)
        .values({ key, value })
        .onConflictDoUpdate({ target: aiCache.key, set: { value, createdAt: sql`now()` } });
    },
  };
}

/** In-memory store for tests and local runs without a database. */
export function createMemoryAiStore(): AiStore & {
  usage: Map<string, { requests: number; input: number; output: number }>;
  spend: Map<string, { reserved: number; spent: number }>;
} {
  const profiles = new Map<string, AiProfile>();
  const usage = new Map<string, { requests: number; input: number; output: number }>();
  const spend = new Map<string, { reserved: number; spent: number }>();
  const cache = new Map<string, { value: unknown; at: number }>();
  const usageRow = (userId: string, day: string) => {
    const key = `${userId}:${day}`;
    let row = usage.get(key);
    if (!row) {
      row = { requests: 0, input: 0, output: 0 };
      usage.set(key, row);
    }
    return row;
  };
  const spendRow = (provider: string, month: string) => {
    const key = `${provider}:${month}`;
    let row = spend.get(key);
    if (!row) {
      row = { reserved: 0, spent: 0 };
      spend.set(key, row);
    }
    return row;
  };
  return {
    usage,
    spend,
    profile: async (userId) => profiles.get(userId) ?? { plan: 'free', pinned: false },
    pin: async (userId) => {
      profiles.set(userId, { plan: profiles.get(userId)?.plan ?? 'free', pinned: true });
    },
    reserveRequest: async (userId, day, limit) => {
      const row = usageRow(userId, day);
      if (row.requests >= limit) return null;
      row.requests++;
      return limit - row.requests;
    },
    releaseRequest: async (userId, day) => {
      const row = usageRow(userId, day);
      row.requests = Math.max(row.requests - 1, 0);
    },
    addTokens: async (userId, day, input, output) => {
      const row = usageRow(userId, day);
      row.input += input;
      row.output += output;
    },
    reserveSpend: async (provider, month, micros, budget) => {
      const row = spendRow(provider, month);
      if (row.reserved + row.spent + micros > budget) return false;
      row.reserved += micros;
      return true;
    },
    settleSpend: async (provider, month, reserved, actual) => {
      const row = spendRow(provider, month);
      row.reserved = Math.max(row.reserved - reserved, 0);
      row.spent += actual;
    },
    cacheGet: async (key, maxAgeMs) => {
      const hit = cache.get(key);
      return hit && Date.now() - hit.at < maxAgeMs ? hit.value : undefined;
    },
    cachePut: async (key, value) => {
      cache.set(key, { value, at: Date.now() });
    },
  };
}
