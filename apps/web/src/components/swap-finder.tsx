'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getUi, type Locale } from '@/i18n/ui';
import { ingredientName } from '@/lib/catalog';
import {
  fetchSwaps,
  MAX_SUGGESTIONS,
  orderChips,
  type SwapAnswer,
  type SwapResult,
} from '@/lib/swaps';
import { useUserData } from '@/lib/use-user-data';

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; answer: SwapAnswer; limitReached: boolean }
  | { phase: 'error' };

const button =
  'inline-flex min-h-12 items-center justify-center rounded-pill border px-6 font-semibold';

/** Ingredient substitutes for the recipe page. A client island: the page itself stays static. */
export function SwapFinder({
  recipeId,
  ingredientIds,
  locale,
}: {
  recipeId: string;
  /** Non-garnish ingredient ids of the recipe. */
  ingredientIds: readonly string[];
  locale: Locale;
}) {
  const ui = getUi(locale).swap;
  const { mode, bar } = useUserData();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [unauthorized, setUnauthorized] = useState(false);
  const request = useRef<AbortController | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => () => request.current?.abort(), []);

  const signInHref =
    `/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/recipes/${recipeId}`)}` as Route;
  const signedIn = mode === 'signed-in' && !unauthorized;

  if (!signedIn) {
    return (
      <div className="mt-6">
        <Link href={signInHref} className={`${button} border-line text-ink hover:bg-surface`}>
          {ui.button}
        </Link>
        <p className="mt-3 text-sm text-ink-muted">{ui.signInCaption}</p>
      </div>
    );
  }

  const choose = async (ingredientId: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPicked(ingredientId);
    setState({ phase: 'loading' });
    const result: SwapResult = await fetchSwaps(
      (input, init) => fetch(input, init),
      { recipeId, ingredientId, bar, locale },
      controller.signal,
    );
    if (controller.signal.aborted) return;
    if (result.kind === 'unauthorized') setUnauthorized(true);
    else if (result.kind === 'error') setState({ phase: 'error' });
    else setState({ phase: 'done', answer: result.answer, limitReached: result.limitReached });
  };

  const chips = orderChips(ingredientIds, bar);

  return (
    <div className="mt-6">
      <button
        ref={toggle}
        type="button"
        aria-expanded={open}
        aria-controls="swap-panel"
        onClick={() => setOpen((v) => !v)}
        className={`${button} border-line text-ink hover:bg-surface`}
      >
        {ui.button}
      </button>
      {open && (
        <div id="swap-panel" className="mt-4">
          <p id="swap-pick" className="text-sm text-ink-muted">
            {ui.pickLabel}
          </p>
          <ul aria-labelledby="swap-pick" className="mt-3 flex flex-wrap gap-2">
            {chips.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  aria-pressed={picked === id}
                  onClick={() => choose(id)}
                  className={`inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-semibold ${
                    picked === id
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-line bg-surface text-ink hover:bg-surface-raised'
                  }`}
                >
                  {ingredientName(id, locale)}
                </button>
              </li>
            ))}
          </ul>
          <div role="status" aria-live="polite" className="mt-4">
            {state.phase === 'loading' && <p className="text-ink-muted">{ui.loading}</p>}
            {state.phase === 'error' && (
              <p className="flex flex-wrap items-center gap-3 text-ink">
                {ui.failed}
                <button
                  type="button"
                  onClick={() => picked && choose(picked)}
                  className="inline-flex min-h-11 items-center rounded-pill border border-line px-4 text-sm font-semibold text-ink hover:bg-surface"
                >
                  {ui.retry}
                </button>
              </p>
            )}
            {state.phase === 'done' && <SwapAnswerView state={state} locale={locale} />}
          </div>
        </div>
      )}
    </div>
  );
}

function SwapAnswerView({
  state,
  locale,
}: {
  state: { answer: SwapAnswer; limitReached: boolean };
  locale: Locale;
}) {
  const ui = getUi(locale).swap;
  const { answer, limitReached } = state;
  const suggestions = answer.suggestions.slice(0, MAX_SUGGESTIONS);
  return (
    <div className="flex flex-col gap-3">
      {answer.source === 'ai' && (
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{ui.ai}</p>
      )}
      {limitReached && <p className="text-sm text-ink-muted">{ui.limit}</p>}
      {suggestions.length === 0 ? (
        <p>{ui.none}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {suggestions.map((s) => (
            <li key={s.ingredientId} className="rounded-md bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{ingredientName(s.ingredientId, locale)}</span>
                {s.inBar && (
                  <span className="rounded-pill bg-mint px-2 py-0.5 text-xs font-semibold text-on-mint">
                    {ui.inBar}
                  </span>
                )}
                <span className="text-sm text-ink-muted">
                  {s.fit === 'close' ? ui.close : ui.workable}
                </span>
              </div>
              {s.note && <p className="mt-2 text-sm text-ink-muted">{s.note}</p>}
            </li>
          ))}
        </ul>
      )}
      {answer.canSkip && <p className="text-sm">{ui.canSkip}</p>}
    </div>
  );
}
