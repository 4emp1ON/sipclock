import { expoClient } from '@better-auth/expo/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { resolveEndpoints } from './endpoints';

export const endpoints = resolveEndpoints(
  {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    powersyncUrl: process.env.EXPO_PUBLIC_POWERSYNC_URL,
  },
  Platform.OS,
  __DEV__,
);

/**
 * Better Auth client (email one-time codes). The expo plugin keeps the session cookie and a cached session in
 * SecureStore under the `sipclock_` prefix, so the signed-in state survives restarts and offline launches.
 */
export const authClient = createAuthClient({
  baseURL: `${endpoints.api}/api/auth`,
  plugins: [
    expoClient({ scheme: 'sipclock', storagePrefix: 'sipclock', storage: SecureStore }),
    emailOTPClient(),
  ],
});

/** Session cookie header for calls to our own API; empty string when signed out. */
export async function sessionCookie(): Promise<string> {
  return (await authClient.getCookie()) ?? '';
}

/** Ask Better Auth to re-read the session, e.g. after the API answered 401. */
export function refreshSession(): void {
  authClient.$store.notify('$sessionSignal');
}
