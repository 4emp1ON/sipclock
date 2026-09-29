import type { Metadata } from 'next';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/i18n/ui';

/** Canonical + hreflang alternates for a locale-less `path` such as "/recipes/negroni". */
export function alternatesFor(locale: Locale, path: string): NonNullable<Metadata['alternates']> {
  const suffix = path === '/' ? '' : path;
  return {
    canonical: `/${locale}${suffix}`,
    languages: {
      ...Object.fromEntries(LOCALES.map((l) => [l, `/${l}${suffix}`])),
      'x-default': `/${DEFAULT_LOCALE}${suffix}`,
    },
  };
}
