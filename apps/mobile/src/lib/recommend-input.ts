import type { Moment, Occasion, RecommendInput } from '@sipclock/domain';

/** Wall-clock fields of a Date in the device's local time zone. */
export function momentFromDate(date: Date, hemisphere: Moment['hemisphere'] = 'north'): Moment {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    weekday: date.getDay(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    hemisphere,
  };
}

export interface TodayState {
  now: Date;
  occasion: Occasion | null;
  alcoholFree: boolean;
  /** Ingredient ids in the bar; `null` while loading. An empty bar is treated as unknown. */
  bar: readonly string[] | null;
  recent: readonly string[];
  seed: number;
}

export function buildRecommendInput(state: TodayState): RecommendInput {
  const input: RecommendInput = {
    moment: momentFromDate(state.now),
    weather: null,
    bar: state.bar && state.bar.length > 0 ? [...state.bar] : null,
    recent: [...state.recent],
    seed: state.seed,
  };
  if (state.occasion) input.occasion = state.occasion;
  if (state.alcoholFree) input.alcoholFree = true;
  return input;
}
