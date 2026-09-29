import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Database } from './db/client.ts';
import * as schema from './db/schema/index.ts';
import type { Env } from './env.ts';

export function createAuth(
  db: Database,
  env: Pick<Env, 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL' | 'CORS_ORIGINS'>,
) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.CORS_ORIGINS,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    emailAndPassword: { enabled: true },
  });
}

/** The only part of Better Auth the HTTP layer depends on (easy to fake in tests). */
export type AuthHandler = { handler: (request: Request) => Promise<Response> };
