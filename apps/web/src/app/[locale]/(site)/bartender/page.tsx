import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Bartender } from '@/components/bartender';
import { getUi, isLocale, LOCALES } from '@/i18n/ui';

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/bartender'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const ui = getUi(locale).bartender;
  // A per-user chat, not content for search.
  return { title: ui.title, description: ui.description, robots: { index: false, follow: false } };
}

export default async function BartenderPage({ params }: PageProps<'/[locale]/bartender'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Bartender locale={locale} />;
}
