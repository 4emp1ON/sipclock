import type { Metadata, Viewport } from 'next';
import { Onest, Unbounded } from 'next/font/google';
import { notFound } from 'next/navigation';
import '../globals.css';
import { getUi, isLocale, LOCALES } from '@/i18n/ui';
import { alternatesFor } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';

const unbounded = Unbounded({
  variable: '--font-unbounded',
  subsets: ['cyrillic', 'latin'],
  display: 'swap',
});

const onest = Onest({
  variable: '--font-onest',
  subsets: ['cyrillic', 'latin'],
  display: 'swap',
});

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const ui = getUi(locale);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: ui.siteTitle, template: '%s | Sipclock' },
    description: ui.siteDescription,
    alternates: alternatesFor(locale, '/'),
    openGraph: { siteName: 'Sipclock', locale: locale === 'ru' ? 'ru_RU' : 'en_US' },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#17102e' },
    { media: '(prefers-color-scheme: light)', color: '#f5f2ff' },
  ],
};

// Runs before first paint so the theme never flashes.
const themeScript = `(function(){try{var m=matchMedia('(prefers-color-scheme: light)');var a=function(){document.documentElement.setAttribute('data-theme',m.matches?'day':'night')};a();m.addEventListener('change',a)}catch(e){}})()`;

export default async function RootLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html
      lang={locale}
      data-theme="night"
      suppressHydrationWarning
      className={`${unbounded.variable} ${onest.variable} h-full`}
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static, trusted theme bootstrap
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body className="flex min-h-full flex-col font-text">{children}</body>
    </html>
  );
}
