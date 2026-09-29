import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context, MiddlewareHandler } from 'hono';
import { problemResponse, titleFor } from '../lib/errors.ts';
import type { AppEnv } from '../types.ts';

export interface RateLimitHit {
  /** Requests counted in the current window, including this one. */
  count: number;
  /** Epoch ms when the current window ends. */
  resetAt: number;
}

/** Counter storage for the fixed-window limiter; swap for Postgres/Redis by implementing this. */
export interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<RateLimitHit>;
  close?(): void;
}

export interface MemoryStoreOptions {
  now?: () => number;
  /** How often expired windows are dropped. `0` disables the timer. Default 60s. */
  cleanupIntervalMs?: number;
  /** Upper bound on tracked keys; the oldest windows are evicted beyond it. Default 100 000. */
  maxKeys?: number;
}

export interface MemoryRateLimitStore extends RateLimitStore {
  /** Drops expired windows now; returns how many were removed. */
  sweep(): number;
  size(): number;
  close(): void;
}

export function createMemoryRateLimitStore(options: MemoryStoreOptions = {}): MemoryRateLimitStore {
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? 100_000;
  const windows = new Map<string, RateLimitHit>();

  function sweep(): number {
    const t = now();
    let removed = 0;
    for (const [key, w] of windows) {
      if (w.resetAt <= t) {
        windows.delete(key);
        removed++;
      }
    }
    return removed;
  }

  const interval = options.cleanupIntervalMs ?? 60_000;
  const timer = interval > 0 ? setInterval(sweep, interval) : undefined;
  timer?.unref();

  return {
    async hit(key, windowMs) {
      const t = now();
      const current = windows.get(key);
      if (!current || current.resetAt <= t) {
        const fresh = { count: 1, resetAt: t + windowMs };
        windows.delete(key);
        if (windows.size >= maxKeys) {
          sweep();
          // Map iterates in insertion order, so the first keys hold the oldest windows.
          for (const k of windows.keys()) {
            if (windows.size < maxKeys) break;
            windows.delete(k);
          }
        }
        windows.set(key, fresh);
        return { ...fresh };
      }
      current.count++;
      return { ...current };
    },
    sweep,
    size: () => windows.size,
    close: () => {
      if (timer) clearInterval(timer);
      windows.clear();
    },
  };
}

export interface ClientIpOptions {
  /**
   * Number of reverse proxies in front of the API that append to `X-Forwarded-For`. `0` ignores the
   * header. Proxies append the address they saw, so the client is the entry `trustedProxyHops` from
   * the right; everything to its left is client-controlled and never trusted.
   */
  trustedProxyHops: number;
}

/** Best-effort client address: trusted proxy hop, else the socket address, else a shared fallback. */
export function clientIp(c: Context, { trustedProxyHops }: ClientIpOptions): string {
  if (trustedProxyHops > 0) {
    const hops = (c.req.header('x-forwarded-for') ?? '')
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
    const client = hops[hops.length - trustedProxyHops];
    if (client) return client;
  }
  try {
    const address = getConnInfo(c).remote.address;
    if (address) return address;
  } catch {
    // No Node socket (e.g. app.request() in tests).
  }
  return 'unknown';
}

export interface RateLimitOptions {
  store: RateLimitStore;
  /** Namespace so routes keep separate counters. */
  name: string;
  /** Max requests per window. */
  limit: number;
  windowMs?: number;
  /** See {@link ClientIpOptions.trustedProxyHops}. Default 0. */
  trustedProxyHops?: number;
  /** Clock; must match the store's clock. */
  now?: () => number;
  /** Requests for which this returns false are not counted. */
  skip?: (c: Context) => boolean;
}

/** Fixed-window limiter keyed by client IP; emits IETF draft `RateLimit-*` headers and 429 problem+json. */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler<AppEnv> {
  const windowMs = options.windowMs ?? 60_000;
  const { store, name, limit } = options;
  const now = options.now ?? Date.now;
  return async (c, next) => {
    if (options.skip?.(c)) return next();
    const ip = clientIp(c, { trustedProxyHops: options.trustedProxyHops ?? 0 });
    const { count, resetAt } = await store.hit(`${name}:${ip}`, windowMs);
    const resetSeconds = Math.max(0, Math.ceil((resetAt - now()) / 1000));
    const headers: Record<string, string> = {
      'RateLimit-Limit': String(limit),
      'RateLimit-Remaining': String(Math.max(0, limit - count)),
      'RateLimit-Reset': String(resetSeconds),
    };
    if (count > limit) {
      const res = problemResponse({
        type: 'about:blank',
        title: titleFor(429),
        status: 429,
        detail: `Rate limit exceeded; retry in ${resetSeconds}s`,
        instance: c.req.path,
        requestId: c.get('requestId') ?? '',
      });
      for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
      res.headers.set('Retry-After', String(Math.max(1, resetSeconds)));
      return res;
    }
    await next();
    for (const [k, v] of Object.entries(headers)) c.res.headers.set(k, v);
    return undefined;
  };
}
