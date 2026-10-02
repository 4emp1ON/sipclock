'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AbvBadge } from '@/components/abv-badge';
import type { Locale } from '@/i18n/ui';
import {
  apiSearchUrl,
  applyFilters,
  DEBOUNCE_MS,
  isSearchable,
  normalizeQuery,
  parseSearchResponse,
  type RankedHit,
  readQueryParam,
  withQueryParam,
} from '@/lib/recipe-search';

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
  search: {
    label: string;
    placeholder: string;
    clear: string;
    similar: string;
    noMatches: string; // template with {q}
    noMatchesHint: string;
    clearSearch: string;
  };
  min: string;
  abv: { free: string; aria: string };
  count: string; // template with {n}
  occasions: { id: string; label: string }[];
}

const chip = (on: boolean) =>
  `inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-semibold ${
    on
      ? 'border-primary bg-primary text-on-primary'
      : 'border-line bg-surface text-ink hover:bg-surface-raised'
  }`;

function CardLink({
  card: c,
  locale,
  labels,
  hint,
}: {
  card: RecipeCard;
  locale: Locale;
  labels: BrowserLabels;
  hint?: string;
}) {
  return (
    <Link
      href={`/${locale}/recipes/${c.id}`}
      data-testid="recipe-card"
      className="flex min-h-11 h-full flex-col gap-2 rounded-md bg-surface p-4 hover:bg-surface-raised"
    >
      <span className="font-display text-lg font-semibold leading-snug">{c.name}</span>
      <span className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        <AbvBadge abv={c.abv} labels={labels.abv} />
        <span>
          {c.kind} · <span className="tabular">{c.minutes}</span> {labels.min}
        </span>
      </span>
      {hint && <span className="text-sm text-ink-muted">{hint}</span>}
    </Link>
  );
}

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
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<RankedHit[] | null>(null);
  const urlRead = useRef(false);

  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const searching = isSearchable(query);

  // The page is static, so the shared ?q= is read after mount.
  useEffect(() => {
    const q = readQueryParam(window.location.search);
    urlRead.current = true;
    if (q) {
      setInput(q);
      setQuery(q);
    }
  }, []);

  useEffect(() => {
    const q = normalizeQuery(input);
    if (q === query) return;
    const t = setTimeout(() => setQuery(q), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input, query]);

  useEffect(() => {
    if (!urlRead.current) return;
    const search = withQueryParam(window.location.search, query);
    if (search === window.location.search) return;
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${search}${window.location.hash}`,
    );
  }, [query]);

  // Local results first, then the API order replaces them. Any failure keeps the local results.
  useEffect(() => {
    if (!searching) {
      setHits(null);
      return;
    }
    let current = true;
    const controller = new AbortController();
    const known = new Set(cardsById.keys());
    (async () => {
      try {
        const { localSearch } = await import('@/lib/local-search');
        if (current) setHits(localSearch(query));
      } catch {
        if (current) setHits([]);
      }
      try {
        const res = await fetch(apiSearchUrl(query, locale), {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        if (!res.ok) return;
        const parsed = parseSearchResponse(await res.json(), known);
        if (current && parsed) setHits(parsed.hits);
      } catch {
        // Offline, rate limited, aborted or malformed: the local results stay.
      }
    })();
    return () => {
      current = false;
      controller.abort();
    };
  }, [query, searching, locale, cardsById]);

  const found = useMemo(
    () => (searching && hits ? applyFilters(hits, cardsById, { occasion, zero }) : null),
    [searching, hits, cardsById, occasion, zero],
  );

  const clearSearch = () => {
    setInput('');
    setQuery('');
  };

  const visible = cards.filter(
    (c) => (!occasion || c.occasions.includes(occasion)) && (!zero || c.abv === 0),
  );
  const groups = new Map<string, { label: string; items: RecipeCard[] }>();
  for (const c of visible) {
    const g = groups.get(c.glass) ?? { label: c.glassLabel, items: [] };
    g.items.push(c);
    groups.set(c.glass, g);
  }

  const count = found ? found.length : visible.length;

  return (
    <div>
      <div className="relative mb-4">
        <label htmlFor="recipe-search" className="sr-only">
          {labels.search.label}
        </label>
        <input
          id="recipe-search"
          type="search"
          value={input}
          maxLength={100}
          autoComplete="off"
          placeholder={labels.search.placeholder}
          onChange={(e) => setInput(e.target.value)}
          className="min-h-12 w-full rounded-pill border border-line bg-surface pl-5 pr-24 text-ink placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {input && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-2 top-1/2 inline-flex min-h-11 -translate-y-1/2 items-center rounded-pill px-4 text-sm font-semibold text-ink hover:bg-surface-raised"
          >
            {labels.search.clear}
          </button>
        )}
      </div>

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
        {found || !searching ? labels.count.replace('{n}', String(count)) : ''}
      </p>

      {found && found.length === 0 && (
        <div className="mt-6">
          <p className="font-semibold">{labels.search.noMatches.replace('{q}', query)}</p>
          <p className="mt-1 text-ink-muted">{labels.search.noMatchesHint}</p>
          <button
            type="button"
            onClick={clearSearch}
            className="mt-4 inline-flex min-h-11 items-center rounded-pill border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-raised"
          >
            {labels.search.clearSearch}
          </button>
        </div>
      )}

      {found && found.length > 0 && (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="search-results">
          {found.map(({ card, field }) => (
            <li key={card.id}>
              <CardLink
                card={card}
                locale={locale}
                labels={labels}
                hint={field === 'meaning' ? labels.search.similar : undefined}
              />
            </li>
          ))}
        </ul>
      )}

      {!searching && visible.length === 0 && <p className="mt-6 text-ink-muted">{labels.empty}</p>}

      {!searching &&
        [...groups.entries()].map(([glass, g]) => (
          <section key={glass} aria-labelledby={`g-${glass}`} className="mt-10">
            <h2 id={`g-${glass}`} className="font-display text-xl font-semibold">
              {g.label}
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((c) => (
                <li key={c.id}>
                  <CardLink card={c} locale={locale} labels={labels} />
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
