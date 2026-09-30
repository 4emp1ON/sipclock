import Link from 'next/link';
import { getUi, type Locale } from '@/i18n/ui';
import { AccountLink } from './account-link';
import { LocaleSwitcher } from './locale-switcher';
import { Logo } from './logo';

export function SiteHeader({ locale }: { locale: Locale }) {
  const ui = getUi(locale);
  return (
    <header className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-x-4 px-5 py-2">
      <Logo locale={locale} />
      <div className="flex items-center gap-1">
        <nav aria-label="Main" className="flex items-center">
          <Link
            href={`/${locale}`}
            className="inline-flex min-h-11 items-center rounded-pill px-3 text-sm font-semibold text-ink-muted hover:text-ink"
          >
            {ui.nav.today}
          </Link>
          <Link
            href={`/${locale}/recipes`}
            className="inline-flex min-h-11 items-center rounded-pill px-3 text-sm font-semibold text-ink-muted hover:text-ink"
          >
            {ui.nav.recipes}
          </Link>
        </nav>
        <AccountLink locale={locale} />
        <LocaleSwitcher locale={locale} label={ui.nav.language} />
      </div>
    </header>
  );
}
