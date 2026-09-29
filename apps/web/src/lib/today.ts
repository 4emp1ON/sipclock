import type { Availability, Moment, Occasion, RecommendInput } from '@sipclock/domain';
import type { Locale } from '@sipclock/i18n';
import type { Ui } from '@/i18n/ui';
import { ingredientName } from '@/lib/catalog';

/** Fixed moment (Fri 19:00) used for the server-rendered state so hydration always matches. */
export const INITIAL_MOMENT: Moment = {
  year: 2026,
  month: 9,
  day: 25,
  weekday: 5,
  hour: 19,
  minute: 0,
  hemisphere: 'north',
};
export const INITIAL_SEED = 7;
export const RECENT_LIMIT = 5;

export function momentFromDate(date: Date): Moment {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    weekday: date.getDay(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    hemisphere: 'north',
  };
}

export interface TodayState {
  moment: Moment;
  occasion: Occasion | null;
  alcoholFree: boolean;
  /** Ingredient ids in the user's bar; empty means "not set" and is sent as `null`. */
  bar: readonly string[];
  seed: number;
  recent: readonly string[];
}

export function buildInput(state: TodayState): RecommendInput {
  return {
    moment: state.moment,
    ...(state.occasion ? { occasion: state.occasion } : {}),
    weather: null,
    bar: state.bar.length > 0 ? [...state.bar] : null,
    alcoholFree: state.alcoholFree,
    recent: [...state.recent],
    seed: state.seed,
    alternatives: 3,
  };
}

export function formatClock(moment: Moment): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(moment.hour)}:${pad(moment.minute)}`;
}

export interface AvailabilityPill {
  tone: 'ready' | 'swap' | 'missing';
  label: string;
}

/** Maps engine availability to the pill shown on cards; `unknown` (no bar) has no pill. */
export function availabilityPill(
  availability: Availability,
  ui: Ui,
  locale: Locale,
): AvailabilityPill | null {
  switch (availability.status) {
    case 'ready':
      return { tone: 'ready', label: ui.today.availReady };
    case 'swap':
      return { tone: 'swap', label: ui.today.availSwap(availability.swaps.length) };
    case 'missing':
      return {
        tone: 'missing',
        label: ui.today.availMissing(
          availability.missing.map((id) => ingredientName(id, locale)).join(', '),
        ),
      };
    case 'unknown':
      return null;
  }
}
