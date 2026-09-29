import Link from 'next/link';
import { AbvBadge } from '@/components/abv-badge';
import { GlassIllustration } from '@/components/glass-illustration';
import { Logo } from '@/components/logo';
import { SiteFooter } from '@/components/site-footer';
import { recipes } from '@/data/recipes';

export default function Home() {
  const pick = recipes[0];
  return (
    <>
      <header className="mx-auto flex w-full max-w-[1200px] items-center px-5 py-2">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 py-8 md:py-16">
        <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
          <section aria-labelledby="now-heading">
            <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">Now</p>
            <h1
              id="now-heading"
              className="tabular font-display text-[56px] font-semibold leading-none"
            >
              19:00
            </h1>
            <p className="mt-3 text-base text-ink-muted">Fri, Sep 11 · +27° clear</p>
            <p className="mt-6 max-w-md text-lg">
              What to make right now, based on the hour, your home bar, the occasion and the
              weather.
            </p>
            <ul className="mt-8 flex flex-col gap-3 sm:flex-row">
              {recipes.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/recipes/${r.slug}`}
                    className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-6 font-semibold text-on-primary hover:bg-[var(--primary-pressed)]"
                  >
                    View {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {pick && (
            <section aria-label="Sample pick">
              <article className="relative aspect-[4/5] overflow-hidden rounded-lg bg-surface-raised shadow-card">
                <GlassIllustration className="absolute inset-x-0 top-8 mx-auto h-3/5" />
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-[var(--photo-scrim)] p-5 text-[var(--on-photo)]">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-2xl font-semibold">{pick.name}</h2>
                    <AbvBadge abv={pick.abv} />
                  </div>
                  <p className="text-sm text-[var(--on-photo-muted)]">
                    {pick.kind} · {pick.profile}
                  </p>
                </div>
              </article>
              <p className="mt-4 text-sm text-ink-muted">
                <span className="font-semibold text-ink">Why this one</span> Warm evening, light and
                bitter to open the night.
              </p>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
