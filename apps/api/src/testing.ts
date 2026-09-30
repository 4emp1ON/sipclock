// Test doubles shared by the HTTP tests.
import type { AuthHandler } from './auth.ts';
import type { UserDataService } from './services/user-data.ts';

/** Auth fake: `handler` answers with `body`; `getSession` resolves the `x-test-user` header. */
export function fakeAuth(body = 'ok'): AuthHandler {
  return {
    handler: async () => new Response(body),
    getSession: async (headers) => {
      const id = headers.get('x-test-user');
      return id ? { user: { id } } : null;
    },
  };
}

/** User data fake that fails loudly when a test reaches the service unexpectedly. */
export const unusedUserData: UserDataService = {
  applyChanges: async () => {
    throw new Error('userData.applyChanges must not be called');
  },
  snapshot: async () => {
    throw new Error('userData.snapshot must not be called');
  },
};
