import type { Env as HonoEnv } from 'hono';
import type { AuthHandler } from './auth.ts';
import type { Env } from './env.ts';
import type { Logger } from './lib/logger.ts';
import type { RateLimitStore } from './middleware/rate-limit.ts';
import type { CatalogService } from './services/catalog.ts';

export interface AppDeps {
  env: Pick<Env, 'CORS_ORIGINS' | 'NODE_ENV' | 'TRUST_PROXY_HOPS' | 'RATE_LIMIT_RECOMMEND_PER_MIN'>;
  catalog: CatalogService;
  rateLimitStore: RateLimitStore;
  auth: AuthHandler;
  /** Database liveness probe used by /ready. */
  ping: () => Promise<void>;
  logger: Logger;
}

export interface AppEnv extends HonoEnv {
  Variables: { requestId: string };
}
