import type { Env as HonoEnv } from 'hono';
import type { AiGateway } from './ai/gateway.ts';
import type { CountryLookup } from './ai/region.ts';
import type { AuthHandler } from './auth.ts';
import type { Env } from './env.ts';
import type { Logger } from './lib/logger.ts';
import type { RateLimitStore } from './middleware/rate-limit.ts';
import type { CatalogService } from './services/catalog.ts';
import type { SearchService } from './services/search.ts';
import type { UserDataService } from './services/user-data.ts';

export interface AppDeps {
  env: Pick<
    Env,
    'CORS_ORIGINS' | 'NODE_ENV' | 'TRUST_PROXY_HOPS' | 'RATE_LIMIT_RECOMMEND_PER_MIN'
  > &
    Partial<
      Pick<Env, 'PUBLIC_BASE_URL' | 'API_DOCS_USERNAME' | 'API_DOCS_PASSWORD' | 'EDGE_PROXY_SECRET'>
    >;
  catalog: CatalogService;
  /** Signed-in user's bar, favorites and history (`/v1/me/*`). */
  userData: UserDataService;
  rateLimitStore: RateLimitStore;
  auth: AuthHandler;
  /** AI gateway (`/v1/ai/*`); the routes are not mounted without it. */
  ai?: { gateway: AiGateway; countryOf: CountryLookup };
  /** Recipe search (`/v1/search`); lexical only when omitted. */
  search?: SearchService;
  /** Database liveness probe used by /ready. */
  ping: () => Promise<void>;
  logger: Logger;
}

export interface AppEnv extends HonoEnv {
  Variables: {
    requestId: string;
    /** Signed-in user; set by `requireSession` on `/v1/me/*` and `/v1/ai/*`. */
    userId: string;
  };
}
