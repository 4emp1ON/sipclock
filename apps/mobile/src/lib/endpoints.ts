export interface Endpoints {
  /** API origin plus path prefix, no trailing slash. Better Auth lives at `${api}/api/auth`. */
  api: string;
  /** PowerSync service URL, no trailing slash (PowerSync appends `/sync/stream`). */
  powersync: string;
}

export const PRODUCTION_ENDPOINTS: Endpoints = {
  api: 'https://4db4f06b3824.vps.myjino.ru/sipclock',
  powersync: 'https://4db4f06b3824.vps.myjino.ru/sipclock/powersync',
};

export interface EndpointEnv {
  apiUrl?: string | undefined;
  powersyncUrl?: string | undefined;
}

const trimSlash = (url: string) => url.trim().replace(/\/+$/, '');

/**
 * Explicit `EXPO_PUBLIC_*` values win. Otherwise development builds talk to services on the dev machine
 * (the Android emulator reaches it at 10.0.2.2) and release builds to production.
 */
export function resolveEndpoints(env: EndpointEnv, platform: string, isDev: boolean): Endpoints {
  const devHost = platform === 'android' ? '10.0.2.2' : 'localhost';
  const defaults = isDev
    ? { api: `http://${devHost}:8787`, powersync: `http://${devHost}:8080` }
    : PRODUCTION_ENDPOINTS;
  return {
    api: env.apiUrl?.trim() ? trimSlash(env.apiUrl) : defaults.api,
    powersync: env.powersyncUrl?.trim() ? trimSlash(env.powersyncUrl) : defaults.powersync,
  };
}
