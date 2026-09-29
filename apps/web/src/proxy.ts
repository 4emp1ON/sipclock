import { type NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/ui';

/** Picks the first supported language from an Accept-Language header, honoring q-values. */
export function preferredLocale(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(',')
    .map((part, order) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return {
        lang: tag.trim().toLowerCase().split('-')[0] ?? '',
        q: q ? Number(q.slice(2)) : 1,
        order,
      };
    })
    .filter((x) => x.q > 0 && Number.isFinite(x.q))
    .sort((a, b) => b.q - a.q || a.order - b.order);
  for (const { lang } of ranked) if (isLocale(lang)) return lang;
  return DEFAULT_LOCALE;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (/^\/(en|ru)(\/|$)/.test(pathname)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request.headers.get('accept-language'))}${pathname === '/' ? '' : pathname}`;
  const res = NextResponse.redirect(url);
  res.headers.set('Vary', 'Accept-Language');
  return res;
}

export const config = {
  // Skip Next internals and any path with a file extension (favicon.ico, robots.txt, sitemap.xml).
  matcher: ['/((?!_next|monitoring|.*\\..*).*)'],
};
