import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SignInForm } from '@/components/sign-in-form';
import { getUi, isLocale, LOCALES } from '@/i18n/ui';

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/sign-in'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getUi(locale).auth.title, robots: { index: false, follow: false } };
}

export default async function SignInPage({ params }: PageProps<'/[locale]/sign-in'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ui = getUi(locale);
  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight">{ui.auth.title}</h1>
      <p className="mt-3 max-w-2xl text-ink-muted">{ui.auth.lead}</p>
      <SignInForm locale={locale} />
    </div>
  );
}
