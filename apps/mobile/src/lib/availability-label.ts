import type { Availability } from '@sipclock/domain';
import type { Locale } from '@sipclock/i18n';

import { ingredientName } from './locale';
import { strings } from './strings';

/** Pill text for a recipe's availability; `null` when the bar is unknown. */
export function availabilityLabel(
  a: Availability,
  locale: Locale,
  name: (id: string, locale: Locale) => string = ingredientName,
): string | null {
  const s = strings[locale];
  switch (a.status) {
    case 'ready':
      return s.availReady;
    case 'swap':
      return s.availSwap(a.swaps.length);
    case 'missing':
      return s.availMissing(a.missing.map((id) => name(id, locale)).join(', '));
    case 'unknown':
      return null;
  }
}
