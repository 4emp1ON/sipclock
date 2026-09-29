import type { Metadata, Viewport } from 'next';
import { Onest, Unbounded } from 'next/font/google';
import './globals.css';
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Sipclock - what to make right now', template: '%s | Sipclock' },
  description:
    'Sipclock picks a cocktail for this date and hour, based on your home bar, the occasion and the weather.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#17102e' },
    { media: '(prefers-color-scheme: light)', color: '#f5f2ff' },
  ],
};

// Runs before first paint so the theme never flashes.
const themeScript = `(function(){try{var m=matchMedia('(prefers-color-scheme: light)');var a=function(){document.documentElement.setAttribute('data-theme',m.matches?'day':'night')};a();m.addEventListener('change',a)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
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
