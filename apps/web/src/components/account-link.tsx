'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getUi, type Locale } from '@/i18n/ui';
import { authClient } from '@/lib/auth-client';

const CLASS =
  'inline-flex min-h-11 min-w-24 items-center justify-center rounded-pill px-3 text-sm font-semibold text-ink-muted hover:text-ink';

/** Header entry: Sign in / Account. Fixed-width placeholder while the session loads, so nothing shifts. */
export function AccountLink({ locale }: { locale: Locale }) {
  const ui = getUi(locale);
  const pathname = usePathname();
  const { data, isPending } = authClient.useSession();

  if (isPending) return <span aria-hidden className={`${CLASS} invisible`} />;
  if (data) {
    return (
      <Link href={`/${locale}/account`} className={CLASS}>
        {ui.nav.account}
      </Link>
    );
  }
  const onSignIn = pathname.endsWith('/sign-in');
  const next = pathname && !onSignIn ? `?next=${encodeURIComponent(pathname)}` : '';
  return (
    <Link href={`/${locale}/sign-in${next}` as Route} className={CLASS}>
      {ui.nav.signIn}
    </Link>
  );
}
