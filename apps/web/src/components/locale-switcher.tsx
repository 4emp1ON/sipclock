'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LOCALES, type Locale } from '@/i18n/ui';

/** Links to the same page in the other locales. */
export function LocaleSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname();
  const rest = pathname.replace(/^\/(en|ru)(?=\/|$)/, '');
  return (
    <nav aria-label={label} className="flex items-center gap-1">
      {LOCALES.map((l) => (
        <Link
          key={l}
          href={`/${l}${rest}` as Route}
          hrefLang={l}
          lang={l}
          aria-current={l === locale ? 'true' : undefined}
          className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-pill px-3 text-sm font-semibold uppercase ${
            l === locale ? 'bg-surface-raised text-ink' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {l}
        </Link>
      ))}
    </nav>
  );
}
