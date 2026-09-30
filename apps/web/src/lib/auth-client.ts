'use client';

import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// No baseURL: the client talks to the same origin, where /api/auth/* is proxied to the API (docs/adr/0006).
export const authClient = createAuthClient({ plugins: [emailOTPClient()] });
