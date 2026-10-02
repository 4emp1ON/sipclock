import { serve } from '@hono/node-server';
import { createAiGateway } from './ai/gateway.ts';
import { createEmbedder, createModelRegistry } from './ai/providers.ts';
import { createCountryLookup, unknownCountry } from './ai/region.ts';
import { createAiStore } from './ai/store.ts';
import { createApp } from './app.ts';
import { createAuth, toAuthHandler } from './auth.ts';
import { createDb } from './db/client.ts';
import { parseEnv } from './env.ts';
import { createLogger } from './lib/logger.ts';
import { flushSentry, initSentry } from './lib/sentry.ts';
import { createMemoryRateLimitStore } from './middleware/rate-limit.ts';
import { createBundledCatalogService } from './services/catalog.ts';
import { createPgEmbeddingStore, createSearchService } from './services/search.ts';
import { createUserDataService } from './services/user-data.ts';

const env = parseEnv();
const logger = createLogger(env.LOG_LEVEL);
const sentryEnabled = initSentry(env);

const database = createDb(env.DATABASE_URL);
const rateLimitStore = createMemoryRateLimitStore();
const auth = toAuthHandler(createAuth(database.db, env, logger));
const catalog = createBundledCatalogService(process.env.CATALOG_DIR);
const userData = createUserDataService(database.db, catalog);
const registry = createModelRegistry(env);
const aiStore = createAiStore(database.db);
const aiGateway = createAiGateway({
  registry,
  store: aiStore,
  logger,
  dailyLimits: { free: env.AI_FREE_DAILY_REQUESTS },
});
const embedder = createEmbedder(env);
const search = createSearchService({
  catalog,
  store: createPgEmbeddingStore(database.db),
  embedder,
  spend: aiStore,
  budget: registry.budgets.yandex,
  logger,
});
const countryOf = env.GEOIP_DB_PATH ? createCountryLookup(env.GEOIP_DB_PATH) : unknownCountry;
const app = createApp({
  env,
  auth,
  ping: database.ping,
  logger,
  catalog,
  userData,
  rateLimitStore,
  ai: { gateway: aiGateway, countryOf },
  search,
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info('server listening', {
    port: info.port,
    env: env.NODE_ENV,
    sentry: sentryEnabled,
    ai: aiGateway.enabled,
    geoip: env.GEOIP_DB_PATH !== undefined,
  });
  // Embeds only recipes whose text changed; search stays lexical for what is not embedded yet.
  const started = performance.now();
  search
    .indexCatalog()
    .then((r) =>
      logger.info('search index ready', { ...r, ms: Math.round(performance.now() - started) }),
    )
    .catch((error: unknown) =>
      logger.warn('search index failed', {
        error: error instanceof Error ? error.message : String(error),
      }),
    );
});

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('shutting down', { signal });
  const force = setTimeout(() => {
    logger.error('forced exit after timeout');
    process.exit(1);
  }, 10_000);
  force.unref();
  server.close(async (err) => {
    try {
      rateLimitStore.close();
      await database.close();
      await flushSentry();
    } finally {
      process.exit(err ? 1 : 0);
    }
  });
  // Drop idle keep-alive connections so close() can complete.
  if ('closeIdleConnections' in server) server.closeIdleConnections();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
