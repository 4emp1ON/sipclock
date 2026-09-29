import { notFound } from 'next/navigation';
import { Today } from '@/components/today';
import { isLocale, LOCALES } from '@/i18n/ui';

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function Home({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <div className="py-0 md:py-8">
      <Today locale={locale} />
    </div>
  );
}
