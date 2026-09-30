'use client';

import type { Occasion } from '@sipclock/domain';
import { recommend } from '@sipclock/engine';
import { glassLabel, methodLabel, reasonLine } from '@sipclock/i18n';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AbvBadge } from '@/components/abv-badge';
import { GlassIllustration } from '@/components/glass-illustration';
import { getUi, type Locale } from '@/i18n/ui';
import { catalog, ingredientName, recipesById } from '@/lib/catalog';
import {
  availabilityPill,
  buildInput,
  formatClock,
  INITIAL_MOMENT,
  INITIAL_SEED,
  momentFromDate,
  RECENT_LIMIT,
  type TodayState,
} from '@/lib/today';
import { useUserData } from '@/lib/use-user-data';

const OCCASIONS: Occasion[] = ['after-work', 'date', 'party', 'chill', 'brunch'];
const KIND_ORDER = [
  'spirit',
  'liqueur',
  'wine',
  'beer',
  'bitters',
  'syrup',
  'juice',
  'mixer',
  'fresh',
  'dairy',
  'pantry',
] as const;
const KIND_LABEL: Record<Locale, Record<(typeof KIND_ORDER)[number], string>> = {
  en: {
    spirit: 'Spirits',
    liqueur: 'Liqueurs',
    wine: 'Wine',
    beer: 'Beer',
    bitters: 'Bitters',
    syrup: 'Syrups',
    juice: 'Juices',
    mixer: 'Mixers',
    fresh: 'Fresh',
    dairy: 'Dairy',
    pantry: 'Pantry',
  },
  ru: {
    spirit: 'Крепкое',
    liqueur: 'Ликёры',
    wine: 'Вино',
    beer: 'Пиво',
    bitters: 'Биттеры',
    syrup: 'Сиропы',
    juice: 'Соки',
    mixer: 'Миксеры',
    fresh: 'Свежее',
    dairy: 'Молочное',
    pantry: 'Кладовая',
  },
};

const chip = (on: boolean) =>
  `inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-semibold ${
    on
      ? 'border-primary bg-primary text-on-primary'
      : 'border-line bg-surface text-ink hover:bg-surface-raised'
  }`;

const PILL_TONE = {
  ready: 'bg-mint text-on-mint',
  swap: 'border border-line bg-surface text-ink',
  missing: 'border border-danger bg-surface text-danger',
} as const;

export function Today({ locale }: { locale: Locale }) {
  const ui = getUi(locale);
  const userData = useUserData();
  // Deterministic first render (fixed moment and seed, empty bar) so server and client HTML match.
  const [state, setState] = useState<TodayState>({
    moment: INITIAL_MOMENT,
    occasion: null,
    alcoholFree: false,
    bar: [],
    seed: INITIAL_SEED,
    recent: [],
  });

  useEffect(() => {
    setState((s) => ({
      ...s,
      moment: momentFromDate(new Date()),
      seed: Math.floor(Math.random() * 2 ** 31),
    }));
  }, []);

  const rec = recommend(buildInput({ ...state, bar: userData.bar }), catalog);
  const pickRecipe = rec.pick ? recipesById.get(rec.pick.recipeId) : undefined;
  const pill = rec.pick ? availabilityPill(rec.pick.availability, ui, locale) : null;
  const m = state.moment;
  const dateText = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(m.year, m.month - 1, m.day));

  const toggleIngredient = userData.toggleBar;
  const clearBar = userData.clearBar;
  const anotherIdea = () => {
    setState({
      ...state,
      seed: Math.floor(Math.random() * 2 ** 31),
      recent: rec.pick
        ? [rec.pick.recipeId, ...state.recent.filter((x) => x !== rec.pick?.recipeId)].slice(
            0,
            RECENT_LIMIT,
          )
        : state.recent,
    });
  };

  const groups = KIND_ORDER.map((kind) => ({
    kind,
    items: catalog.ingredients.filter((i) => i.kind === kind),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="grid gap-10 md:grid-cols-2 md:items-start md:gap-16">
      <section aria-labelledby="now-heading">
        <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">{ui.today.now}</p>
        <h1
          id="now-heading"
          className="tabular font-display text-[56px] font-semibold leading-none"
        >
          {formatClock(m)}
        </h1>
        <p className="mt-3 text-base text-ink-muted">{dateText}</p>
        <p className="mt-6 max-w-md text-lg">{ui.today.lead}</p>

        <div className="mt-8">
          <h2 className="text-sm font-semibold text-ink-muted">{ui.today.occasion}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={state.occasion === o}
                onClick={() => setState({ ...state, occasion: state.occasion === o ? null : o })}
                className={chip(state.occasion === o)}
              >
                {ui.occasions[o]}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={state.alcoholFree}
              onClick={() => setState({ ...state, alcoholFree: !state.alcoholFree })}
              className={chip(state.alcoholFree)}
            >
              {ui.today.noAlcohol}
            </button>
          </div>
        </div>

        <details className="mt-8 rounded-md bg-surface">
          <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 font-semibold">
            <span>{ui.today.myBar}</span>
            <span className="tabular text-sm font-normal text-ink-muted">
              {ui.today.barCount(userData.bar.length)}
            </span>
          </summary>
          <div className="px-4 pb-4">
            <p className="text-sm text-ink-muted">
              {userData.mode === 'signed-in' ? ui.today.myBarHintSynced : ui.today.myBarHint}
            </p>
            {userData.bar.length > 0 && (
              <button
                type="button"
                onClick={clearBar}
                className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline"
              >
                {ui.today.clearBar}
              </button>
            )}
            {groups.map((g) => (
              <fieldset key={g.kind} className="mt-4">
                <legend className="text-sm font-semibold">{KIND_LABEL[locale][g.kind]}</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {g.items.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      aria-pressed={userData.bar.includes(i.id)}
                      onClick={() => toggleIngredient(i.id)}
                      className={chip(userData.bar.includes(i.id))}
                    >
                      {i.name[locale]}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </details>
      </section>

      <section aria-label={ui.today.whyThis}>
        {rec.pick && pickRecipe ? (
          <article
            data-testid="pick"
            className="overflow-hidden rounded-lg bg-surface-raised shadow-card"
          >
            <GlassIllustration className="mx-auto mt-6 h-40" />
            <div className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 data-testid="pick-name" className="font-display text-2xl font-semibold">
                  {pickRecipe.name[locale]}
                </h2>
                <AbvBadge abv={rec.pick.abv} labels={ui.abv} />
              </div>
              <p className="text-sm text-ink-muted">
                {glassLabel[locale][pickRecipe.glass]} · {methodLabel[locale][pickRecipe.method]}
              </p>
              {pill && (
                <p
                  data-testid="availability"
                  className={`inline-flex min-h-8 w-fit items-center rounded-pill px-3 text-sm font-semibold ${PILL_TONE[pill.tone]}`}
                >
                  {pill.label}
                </p>
              )}
              <p data-testid="reason-line" className="text-sm">
                <span className="font-semibold">{ui.today.whyThis}. </span>
                {reasonLine(rec.pick.reasons, locale, ingredientName, 2)}
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <Link
                  href={`/${locale}/recipes/${pickRecipe.id}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-6 font-semibold text-on-primary hover:bg-[var(--primary-pressed)]"
                >
                  {ui.today.openRecipe}
                </Link>
                <button
                  type="button"
                  onClick={anotherIdea}
                  className="inline-flex min-h-12 items-center justify-center rounded-pill border border-line px-6 font-semibold hover:bg-surface"
                >
                  {ui.today.anotherIdea}
                </button>
              </div>
            </div>
          </article>
        ) : (
          <p className="rounded-md bg-surface p-5 text-ink-muted">{ui.today.noPick}</p>
        )}

        {rec.alternatives.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-ink-muted">{ui.today.alternatives}</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {rec.alternatives.map((alt) => {
                const r = recipesById.get(alt.recipeId);
                if (!r) return null;
                const altPill = availabilityPill(alt.availability, ui, locale);
                return (
                  <li key={alt.recipeId}>
                    <Link
                      href={`/${locale}/recipes/${r.id}`}
                      data-testid="alternative"
                      className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md bg-surface px-4 py-3 hover:bg-surface-raised"
                    >
                      <span className="font-semibold">{r.name[locale]}</span>
                      <span className="flex items-center gap-2 text-sm text-ink-muted">
                        {altPill && <span>{altPill.label}</span>}
                        <AbvBadge abv={alt.abv} labels={ui.abv} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
