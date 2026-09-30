import type { Locale } from '@/i18n/ui';

function hasUnsafeChar(value: string): boolean {
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (ch === '\\' || code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Validates a `?next=` value: only a same-site absolute path (`/en/recipes/negroni`) is accepted, so the
 * sign-in redirect can never leave the site. Anything else (or the sign-in page itself) falls back to Today.
 */
export function safeNextPath(value: string | null | undefined, locale: Locale): string {
  const fallback = `/${locale}`;
  if (!value || value.length > 512) return fallback;
  // Reject protocol-relative (`//host`), backslash tricks (`/\host`), control chars and anything not starting with "/".
  if (!value.startsWith('/') || value.startsWith('//') || hasUnsafeChar(value)) {
    return fallback;
  }
  let url: URL;
  try {
    url = new URL(value, 'https://sipclock.invalid');
  } catch {
    return fallback;
  }
  if (url.origin !== 'https://sipclock.invalid') return fallback;
  if (!/^\/(en|ru)(\/|$)/.test(url.pathname)) return fallback;
  if (/^\/(en|ru)\/sign-in(\/|$)/.test(url.pathname)) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
