'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AbvBadge } from '@/components/abv-badge';
import type { Locale } from '@/i18n/ui';

export interface RecipeCard {
  id: string;
  name: string;
  kind: string;
  glass: string;
  glassLabel: string;
  abv: number;
  occasions: string[];
  minutes: number;
}

export interface BrowserLabels {
  all: string;
  alcoholFree: string;
  filters: string;
  empty: string;
  min: string;
  abv: { free: string; alc: string };
  count: string; // template with {n}
  occasions: { id: string; label: string }[];
}

const chip = (on: boolean) =>
  `inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-semibold ${
    on
      ? 'border-primary bg-primary text-on-primary'
      : 'border-line bg-surface text-ink hover:bg-surface-raised'
  }`;

export function RecipeBrowser({
  locale,
  cards,
  labels,
}: {
  locale: Locale;
  cards: RecipeCard[];
  labels: BrowserLabels;
}) {
  const [occasion, setOccasion] = useState<string | null>(null);
  const [zero, setZero] = useState(false);

  const visible = cards.filter(
    (c) => (!occasion || c.occasions.includes(occasion)) && (!zero || c.abv === 0),
  );
  const groups = new Map<string, { label: string; items: RecipeCard[] }>();
  for (const c of visible) {
    const g = groups.get(c.glass) ?? { label: c.glassLabel, items: [] };
    g.items.push(c);
    groups.set(c.glass, g);
  }

  return (
    <div>
      <fieldset aria-label={labels.filters} className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={occasion === null}
          onClick={() => setOccasion(null)}
          className={chip(occasion === null)}
        >
          {labels.all}
        </button>
        {labels.occasions.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={occasion === o.id}
            onClick={() => setOccasion(occasion === o.id ? null : o.id)}
            className={chip(occasion === o.id)}
          >
            {o.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={zero}
          onClick={() => setZero(!zero)}
          className={chip(zero)}
        >
          {labels.alcoholFree}
        </button>
      </fieldset>

      <p className="tabular mt-6 text-sm text-ink-muted" aria-live="polite" data-testid="count">
        {labels.count.replace('{n}', String(visible.length))}
      </p>

      {visible.length === 0 && <p className="mt-6 text-ink-muted">{labels.empty}</p>}

      {[...groups.entries()].map(([glass, g]) => (
        <section key={glass} aria-labelledby={`g-${glass}`} className="mt-10">
          <h2 id={`g-${glass}`} className="font-display text-xl font-semibold">
            {g.label}
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/${locale}/recipes/${c.id}`}
                  data-testid="recipe-card"
                  className="flex min-h-11 h-full flex-col gap-2 rounded-md bg-surface p-4 hover:bg-surface-raised"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-display text-lg font-semibold leading-snug">
                      {c.name}
                    </span>
                    <AbvBadge abv={c.abv} labels={labels.abv} />
                  </span>
                  <span className="text-sm text-ink-muted">
                    {c.kind} · <span className="tabular">{c.minutes}</span> {labels.min}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
