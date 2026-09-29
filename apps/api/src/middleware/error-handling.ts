import * as Sentry from '@sentry/node';
import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ZodError } from 'zod';
import { AppError, type Problem, problemResponse, titleFor } from '../lib/errors.ts';
import type { Logger } from '../lib/logger.ts';
import type { AppEnv } from '../types.ts';

function base(c: Context, status: number, detail?: string, type = 'about:blank'): Problem {
  return {
    type,
    title: titleFor(status),
    status,
    ...(detail === undefined ? {} : { detail }),
    instance: c.req.path,
    requestId: c.get('requestId') ?? '',
  };
}

export function notFoundHandler(): NotFoundHandler<AppEnv> {
  return (c) => problemResponse(base(c, 404, `No route for ${c.req.method} ${c.req.path}`));
}

export function errorHandler(logger: Logger): ErrorHandler<AppEnv> {
  return (err, c) => {
    if (err instanceof AppError) {
      return problemResponse(base(c, err.status, err.detail, err.type));
    }
    if (err instanceof HTTPException && err.status < 500) {
      return problemResponse(base(c, err.status, err.message || undefined));
    }
    const requestId = c.get('requestId');
    logger.error('unhandled error', {
      requestId,
      path: c.req.path,
      error:
        err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
    });
    // No-op unless Sentry.init() ran (i.e. SENTRY_DSN configured).
    Sentry.captureException(err, { tags: { requestId } });
    return problemResponse(base(c, 500));
  };
}

/** Converts zod-openapi validation failures into a 400 problem+json with field errors. */
export function validationHook(
  result: { success: boolean; error?: ZodError },
  c: Context,
): Response | undefined {
  if (result.success || !result.error) return undefined;
  const problem: Problem = {
    ...base(c, 400, 'Request validation failed', 'https://sipclock.app/problems/validation'),
    errors: result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
  };
  return problemResponse(problem);
}
