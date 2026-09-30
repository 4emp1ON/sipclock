import type { MiddlewareHandler } from 'hono';
import { problemResponse, titleFor } from '../lib/errors.ts';
import type { AppEnv } from '../types.ts';
import type { RateLimitStore } from './rate-limit.ts';

export interface EmailLimitOptions {
  store: RateLimitStore;
  /** Namespace so routes keep separate counters. */
  name: string;
  /** Max requests per address per window. */
  limit: number;
  windowMs: number;
  now?: () => number;
}

/** Lower-cased `email` of a JSON body, or `null` when there is none. Leaves the request body unread. */
export async function readEmail(request: Request): Promise<string | null> {
  try {
    const body: unknown = await request.clone().json();
    if (typeof body !== 'object' || body === null || !('email' in body)) return null;
    const { email } = body;
    return typeof email === 'string' ? email.trim().toLowerCase().slice(0, 320) : null;
  } catch {
    return null;
  }
}

/**
 * Fixed-window limit keyed by the email address in the JSON body. It runs before Better Auth, so an
 * over-limit request never reaches it: for the OTP routes this caps both the codes created for an
 * address and the guesses against it, whatever the number of client IPs. Requests without an email
 * pass through (Better Auth rejects them).
 */
export function emailLimit(options: EmailLimitOptions): MiddlewareHandler<AppEnv> {
  const { store, name, limit, windowMs } = options;
  const now = options.now ?? Date.now;
  return async (c, next) => {
    if (c.req.method !== 'POST') return next();
    const email = await readEmail(c.req.raw);
    if (email === null) return next();
    const { count, resetAt } = await store.hit(`${name}:${email}`, windowMs);
    if (count <= limit) return next();
    const retryAfter = Math.max(1, Math.ceil((resetAt - now()) / 1000));
    const res = problemResponse({
      type: 'about:blank',
      title: titleFor(429),
      status: 429,
      detail: `Too many attempts for this address; retry in ${retryAfter}s`,
      instance: c.req.path,
      requestId: c.get('requestId') ?? '',
    });
    res.headers.set('Retry-After', String(retryAfter));
    return res;
  };
}
