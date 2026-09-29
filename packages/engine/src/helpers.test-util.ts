import type { Moment, RecommendInput } from '@sipclock/domain';

export function moment(over: Partial<Moment> = {}): Moment {
  return {
    year: 2026,
    month: 7,
    day: 17,
    weekday: 5,
    hour: 19,
    minute: 0,
    hemisphere: 'north',
    ...over,
  };
}

export function input(over: Partial<RecommendInput> = {}): RecommendInput {
  return { moment: moment(), weather: null, bar: null, seed: 1, ...over };
}
