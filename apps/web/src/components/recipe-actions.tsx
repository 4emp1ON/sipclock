'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';
import { getUi, type Locale } from '@/i18n/ui';
import { useUserData } from '@/lib/use-user-data';

const button =
  'inline-flex min-h-12 items-center justify-center rounded-pill border px-6 font-semibold';

/** Save (favorite) and "I made it" for the recipe page. A client island: the page itself stays static. */
export function RecipeActions({ recipeId, locale }: { recipeId: string; locale: Locale }) {
  const ui = getUi(locale).recipes;
  const { favorites, mode, toggleFavorite, logDrink } = useUserData();
  const [prompt, setPrompt] = useState(false);
  const [logged, setLogged] = useState(false);
  const saved = favorites.includes(recipeId);

  const made = () => {
    if (mode !== 'signed-in') {
      setPrompt(true);
      return;
    }
    logDrink(recipeId);
    setLogged(true);
    setTimeout(() => setLogged(false), 3000);
  };

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          aria-pressed={saved}
          onClick={() => toggleFavorite(recipeId)}
          className={`${button} ${
            saved
              ? 'border-primary bg-primary text-on-primary'
              : 'border-line bg-surface text-ink hover:bg-surface-raised'
          }`}
        >
          {saved ? ui.saved : ui.save}
        </button>
        <button
          type="button"
          onClick={made}
          className={`${button} border-line text-ink hover:bg-surface`}
        >
          {ui.madeIt}
        </button>
      </div>
      {logged && (
        <p role="status" className="mt-3 text-sm text-ink-muted">
          {ui.madeLogged}
        </p>
      )}
      {prompt && mode !== 'signed-in' && (
        <p role="status" className="mt-3 text-sm text-ink-muted">
          {ui.signInToLog}{' '}
          <Link
            href={
              `/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/recipes/${recipeId}`)}` as Route
            }
            className="font-semibold text-ink underline"
          >
            {ui.signInLink}
          </Link>
        </p>
      )}
    </div>
  );
}
