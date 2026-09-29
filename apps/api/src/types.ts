import type { Env as HonoEnv } from 'hono';
import type { AuthHandler } from './auth.ts';
import type { Env } from './env.ts';
import type { Logger } from './lib/logger.ts';

export interface AppDeps {
  env: Pick<Env, 'CORS_ORIGINS' | 'NODE_ENV'>;
  auth: AuthHandler;
  /** Database liveness probe used by /ready. */
  ping: () => Promise<void>;
  logger: Logger;
}

export interface AppEnv extends HonoEnv {
  Variables: { requestId: string };
}
