// Pure helpers for the same-origin API proxy (src/app/api/[...path]/route.ts, docs/adr/0006).

/** Request headers forwarded to the API. Everything else (host, accept-encoding, x-sipclock-*, ...) is dropped. */
const FORWARDED_REQUEST_HEADERS = [
  'cookie',
  'content-type',
  'accept',
  'accept-language',
  'origin',
  'user-agent',
  'idempotency-key',
  'x-request-id',
] as const;

/** Response headers that describe the transfer, not the payload; fetch already decoded the body. */
const DROPPED_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-encoding',
  'content-length',
  'set-cookie',
  'trailer',
  'upgrade',
]);

/**
 * Maps a public path to the API path, or null when the proxy must not serve it.
 * `/api/auth/*` -> `/api/auth/*`, `/api/me/*` -> `/v1/me/*`, `/api/ai/*` -> `/v1/ai/*`.
 */
export function mapProxyPath(pathname: string): string | null {
  if (pathname.includes('\\') || /%(2e|2f|5c)/i.test(pathname)) return null;
  const segments = pathname.split('/');
  if (segments.some((s) => s === '..' || s === '.')) return null;
  // The expo plugin's OAuth helper redirects to any https URL; the web never needs it.
  if (/^\/api\/auth\/expo-authorization-proxy(\/|$)/.test(pathname)) return null;
  if (/^\/api\/auth(\/|$)/.test(pathname)) return pathname;
  const me = /^\/api\/me(\/.*)?$/.exec(pathname);
  if (me) return `/v1/me${me[1] ?? ''}`;
  const ai = /^\/api\/ai(\/.*)?$/.exec(pathname);
  if (ai) return `/v1/ai${ai[1] ?? ''}`;
  return null;
}

/** Upstream timeout: LLM calls need longer than the plain data endpoints. */
export function proxyTimeoutMs(pathname: string): number {
  return /^\/api\/ai(\/|$)/.test(pathname) ? 30_000 : 15_000;
}

/** Client IP as seen by Vercel: first `x-forwarded-for` entry, else `x-real-ip`. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get('x-real-ip')?.trim() || null;
}

export interface UpstreamHeaderOptions {
  /** Shared secret proving the request came through this proxy; omitted when not configured. */
  secret?: string;
}

/**
 * Builds the headers sent to the API: the allowlisted client headers, then the proxy-owned
 * `x-sipclock-*` headers. Client-supplied `x-sipclock-*` never survives because only the allowlist is copied.
 */
export function buildUpstreamHeaders(incoming: Headers, opts: UpstreamHeaderOptions = {}): Headers {
  const out = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = incoming.get(name);
    if (value !== null) out.set(name, value);
  }
  const ip = clientIp(incoming);
  if (ip) out.set('x-sipclock-client-ip', ip);
  if (opts.secret) out.set('x-sipclock-proxy-secret', opts.secret);
  return out;
}

/** Drops `Domain=`: the cookie must belong to the web origin, whatever host the API stamped on it. */
export function rewriteSetCookie(cookie: string): string {
  return cookie
    .split(';')
    .filter((part, i) => i === 0 || !/^\s*domain\s*=/i.test(part))
    .join(';');
}

/** Response headers for the browser: transfer headers removed, `set-cookie` handled separately. */
export function buildDownstreamHeaders(upstream: Headers): Headers {
  const out = new Headers();
  upstream.forEach((value, name) => {
    if (!DROPPED_RESPONSE_HEADERS.has(name.toLowerCase())) out.append(name, value);
  });
  for (const cookie of upstream.getSetCookie()) out.append('set-cookie', rewriteSetCookie(cookie));
  return out;
}
