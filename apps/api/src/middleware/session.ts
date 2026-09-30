import type { MiddlewareHandler } from 'hono';
import type { AuthHandler } from '../auth.ts';
import { problemResponse, titleFor } from '../lib/errors.ts';
import type { AppEnv } from '../types.ts';

/** Rejects requests without a Better Auth session (401 problem+json); sets `userId` otherwise. */
export function requireSession(auth: Pick<AuthHandler, 'getSession'>): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const session = await auth.getSession(c.req.raw.headers);
    if (!session) {
      return problemResponse({
        type: 'about:blank',
        title: titleFor(401),
        status: 401,
        detail: 'Sign in required',
        instance: c.req.path,
        requestId: c.get('requestId') ?? '',
      });
    }
    c.set('userId', session.user.id);
    await next();
    return undefined;
  };
}
