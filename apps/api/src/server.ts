import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { createAuth, toAuthHandler } from './auth.ts';
import { createDb } from './db/client.ts';
import { parseEnv } from './env.ts';
import { createLogger } from './lib/logger.ts';
import { flushSentry, initSentry } from './lib/sentry.ts';
import { createMemoryRateLimitStore } from './middleware/rate-limit.ts';
import { createBundledCatalogService } from './services/catalog.ts';
import { createUserDataService } from './services/user-data.ts';

const env = parseEnv();
const logger = createLogger(env.LOG_LEVEL);
const sentryEnabled = initSentry(env);

const database = createDb(env.DATABASE_URL);
const rateLimitStore = createMemoryRateLimitStore();
const auth = toAuthHandler(createAuth(database.db, env, logger));
const catalog = createBundledCatalogService(process.env.CATALOG_DIR);
const userData = createUserDataService(database.db, catalog);
const app = createApp({
  env,
  auth,
  ping: database.ping,
  logger,
  catalog,
  userData,
  rateLimitStore,
});

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info('server listening', { port: info.port, env: env.NODE_ENV, sentry: sentryEnabled });
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
