import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AccountView } from '@/components/account-view';
import { getUi, isLocale, LOCALES } from '@/i18n/ui';

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/account'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getUi(locale).account.title, robots: { index: false, follow: false } };
}

export default async function AccountPage({ params }: PageProps<'/[locale]/account'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ui = getUi(locale);
  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight">{ui.account.title}</h1>
      <AccountView locale={locale} />
    </div>
  );
}
