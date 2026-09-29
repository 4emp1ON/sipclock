import Link from 'next/link';
import { Logo } from '@/components/logo';
import { SiteFooter } from '@/components/site-footer';

export default function NotFound() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-[1200px] items-center px-5 py-2">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 py-16">
        <h1 className="font-display text-4xl font-semibold">Page not found</h1>
        <p className="mt-4 text-ink-muted">This page does not exist or has moved.</p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-12 items-center rounded-pill bg-primary px-6 font-semibold text-on-primary"
        >
          Back home
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
