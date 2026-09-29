import type { MiddlewareHandler } from 'hono';
import type { Logger } from '../lib/logger.ts';

export function requestLogger(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const start = performance.now();
    await next();
    logger.info('request', {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Math.round((performance.now() - start) * 100) / 100,
      requestId: c.get('requestId'),
    });
  };
}
