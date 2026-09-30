import { notFound } from 'next/navigation';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { UserDataBoundary } from '@/components/user-data-boundary';
import { isLocale } from '@/i18n/ui';

// Site chrome lives in a group below the root layout so `not-found.tsx` here renders inside it.
export default async function SiteLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <>
      <SiteHeader locale={locale} />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 py-8 md:py-12">{children}</main>
      <SiteFooter locale={locale} />
      <UserDataBoundary locale={locale} />
    </>
  );
}
