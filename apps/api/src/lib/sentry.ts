import * as Sentry from '@sentry/node';
import type { Env } from '../env.ts';

/** Initializes Sentry only when a DSN is configured. Returns whether it is active. */
export function initSentry(env: Pick<Env, 'SENTRY_DSN' | 'NODE_ENV'>): boolean {
  if (!env.SENTRY_DSN) return false;
  Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });
  return true;
}

export async function flushSentry(timeoutMs = 2000): Promise<void> {
  await Sentry.flush(timeoutMs);
}
