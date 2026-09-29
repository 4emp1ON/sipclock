'use client';

import type { Amount } from '@sipclock/domain';
import type { UnitSystem } from '@sipclock/engine';
import type { Locale } from '@sipclock/i18n';
import { useState } from 'react';
import { formatIngredientAmount } from '@/lib/amounts';

export interface IngredientRow {
  id: string;
  name: string;
  amount: Amount;
  optional: boolean;
  garnish: boolean;
}

export interface IngredientLabels {
  units: string;
  servings: string;
  ml: string;
  oz: string;
  parts: string;
  optional: string;
  garnish: string;
}

const seg = (on: boolean) =>
  `inline-flex min-h-11 min-w-11 items-center justify-center rounded-pill px-4 text-sm font-semibold ${
    on ? 'bg-primary text-on-primary' : 'text-ink hover:bg-surface-raised'
  }`;

export function IngredientList({
  locale,
  rows,
  partsBase,
  labels,
}: {
  locale: Locale;
  rows: IngredientRow[];
  partsBase: number | null;
  labels: IngredientLabels;
}) {
  const [unit, setUnit] = useState<UnitSystem>('ml');
  const [servings, setServings] = useState(1);
  const units: UnitSystem[] = partsBase === null ? ['ml', 'oz'] : ['ml', 'oz', 'parts'];

  return (
    <div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <fieldset aria-label={labels.units} className="flex rounded-pill bg-surface p-1">
          {units.map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={unit === u}
              onClick={() => setUnit(u)}
              className={seg(unit === u)}
            >
              {labels[u]}
            </button>
          ))}
        </fieldset>
        <fieldset aria-label={labels.servings} className="flex items-center gap-1">
          <span className="mr-2 text-sm text-ink-muted">{labels.servings}</span>
          <button
            type="button"
            aria-label={`${labels.servings} -`}
            disabled={servings <= 1}
            onClick={() => setServings(Math.max(1, servings - 1))}
            className="inline-flex size-11 items-center justify-center rounded-pill bg-surface text-lg font-semibold disabled:opacity-40"
          >
            −
          </button>
          <span
            className="tabular min-w-8 text-center text-sm font-semibold"
            aria-live="polite"
            data-testid="servings"
          >
            {servings}
          </span>
          <button
            type="button"
            aria-label={`${labels.servings} +`}
            disabled={servings >= 12}
            onClick={() => setServings(Math.min(12, servings + 1))}
            className="inline-flex size-11 items-center justify-center rounded-pill bg-surface text-lg font-semibold disabled:opacity-40"
          >
            +
          </button>
        </fieldset>
      </div>

      <ul className="mt-4 divide-y divide-line rounded-md bg-surface">
        {rows.map((r) => (
          <li key={r.id} className="flex justify-between gap-4 px-4 py-3">
            <span>
              {r.name}
              {(r.optional || r.garnish) && (
                <span className="ml-2 text-sm text-ink-muted">
                  ({r.garnish ? labels.garnish : labels.optional})
                </span>
              )}
            </span>
            <span className="tabular text-ink-muted">
              {formatIngredientAmount(r.amount, locale, { unit, servings, partsBase })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
