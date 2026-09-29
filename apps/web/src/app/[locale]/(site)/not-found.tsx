'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DEFAULT_LOCALE, getUi, isLocale } from '@/i18n/ui';

export default function NotFound() {
  // Not-found receives no params; the locale is the first path segment.
  const raw = usePathname().split('/')[1] ?? '';
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const ui = getUi(locale);
  return (
    <div className="py-8">
      <h1 className="font-display text-4xl font-semibold">{ui.notFound.title}</h1>
      <p className="mt-4 text-ink-muted">{ui.notFound.body}</p>
      <Link
        href={`/${locale}`}
        className="mt-8 inline-flex min-h-12 items-center rounded-pill bg-primary px-6 font-semibold text-on-primary"
      >
        {ui.notFound.back}
      </Link>
    </div>
  );
}
