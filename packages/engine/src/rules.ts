import type { Daypart, Moment, Strength, Weather, WeatherFit } from '@sipclock/domain';

export const RULES_VERSION = '2026.10.01';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface DaypartWindow {
  daypart: Daypart;
  /** Inclusive start hour, 0–23. */
  from: number;
  /** Exclusive end hour, 0–24. `to < from` means the window wraps midnight. */
  to: number;
}

export interface Rules {
  version: string;
  /** Recipes with more missing required ingredients are dropped when the bar is known. */
  maxMissing: number;
  dayparts: readonly DaypartWindow[];
  weekend: { days: readonly number[]; fridayFromHour: number };
  weather: { hotFromC: number; coldToC: number };
  /** Upper ABV bounds (inclusive); above `mediumMax` is strong. Zero means exactly 0. */
  strengthBands: { lightMax: number; mediumMax: number };
  /** Weather fits implied by the season (keeps the season signal derived from recipe weather tags). */
  seasonFits: Readonly<Record<Season, readonly WeatherFit[]>>;
  weights: {
    daypart: number;
    weekendBrunch: number;
    weather: number;
    weatherMild: number;
    season: number;
    occasion: number;
    /** Per matching flavor, capped at `tasteMax`. */
    tastePerFlavor: number;
    tasteMax: number;
    strengthMatch: number;
    /** Subtracted per band of distance from the preferred strength. */
    strengthStep: number;
    availabilityReady: number;
    availabilitySwap: number;
    /** Subtracted per missing ingredient. */
    availabilityMissing: number;
    /** Importance of `alcohol-free`/`swap`/`missing` facts when ordering reasons. */
    factWeight: number;
  };
  recent: { penalty: number; decay: number };
  /** Max seeded jitter added to a score; smaller than any single real signal. */
  jitter: number;
  maxReasons: number;
}

export const defaultRules: Rules = {
  version: RULES_VERSION,
  maxMissing: 1,
  dayparts: [
    { daypart: 'brunch', from: 10, to: 14 },
    { daypart: 'aperitif', from: 16, to: 19 },
    { daypart: 'evening', from: 19, to: 23 },
    { daypart: 'late', from: 23, to: 3 },
  ],
  weekend: { days: [0, 6], fridayFromHour: 17 },
  weather: { hotFromC: 25, coldToC: 8 },
  strengthBands: { lightMax: 10, mediumMax: 20 },
  seasonFits: {
    summer: ['hot'],
    winter: ['cold'],
    autumn: ['rainy', 'cold'],
    spring: ['mild'],
  },
  // Scale: the strongest single real signals (daypart, weather, occasion) are 3 points; availability
  // spans -1.5..+2 so a ready drink beats a swap beats a missing one when other signals tie; jitter
  // (<0.75) only reorders near-ties. A `recent` hit (5, decaying) outweighs any two signals.
  weights: {
    daypart: 3,
    weekendBrunch: 1.5,
    weather: 3,
    weatherMild: 1,
    season: 1,
    occasion: 3,
    tastePerFlavor: 1.5,
    tasteMax: 3,
    strengthMatch: 1.5,
    strengthStep: 1,
    availabilityReady: 2,
    availabilitySwap: 1,
    availabilityMissing: 1.5,
    factWeight: 1.2,
  },
  recent: { penalty: 5, decay: 0.7 },
  jitter: 0.75,
  maxReasons: 4,
};

/** Daypart for an hour of the day, or `null` in the gaps (03–10, 14–16) where none applies. */
export function daypartOf(hour: number, rules: Rules = defaultRules): Daypart | null {
  for (const w of rules.dayparts) {
    const inside = w.from <= w.to ? hour >= w.from && hour < w.to : hour >= w.from || hour < w.to;
    if (inside) return w.daypart;
  }
  return null;
}

/** Saturday/Sunday, plus Friday from `fridayFromHour`. */
export function isWeekend(
  moment: Pick<Moment, 'weekday' | 'hour'>,
  rules: Rules = defaultRules,
): boolean {
  if (rules.weekend.days.includes(moment.weekday)) return true;
  return moment.weekday === 5 && moment.hour >= rules.weekend.fridayFromHour;
}

/** Meteorological seasons; southern hemisphere is shifted by six months. */
export function seasonOf(month: number, hemisphere: Moment['hemisphere']): Season {
  const m = hemisphere === 'north' ? month : ((month + 5) % 12) + 1;
  if (m === 12 || m <= 2) return 'winter';
  if (m <= 5) return 'spring';
  if (m <= 8) return 'summer';
  return 'autumn';
}

/**
 * Weather fits, in priority order: hot | cold, then rainy (rain or snow), or `mild` when neither
 * hot nor cold nor precipitation.
 */
export function weatherFits(weather: Weather, rules: Rules = defaultRules): WeatherFit[] {
  const fits: WeatherFit[] = [];
  if (weather.tempC >= rules.weather.hotFromC) fits.push('hot');
  else if (weather.tempC <= rules.weather.coldToC) fits.push('cold');
  if (weather.condition === 'rain' || weather.condition === 'snow') fits.push('rainy');
  if (fits.length === 0) fits.push('mild');
  return fits;
}

const STRENGTH_ORDER: readonly Strength[] = ['zero', 'light', 'medium', 'strong'];

export function strengthOf(abv: number, rules: Rules = defaultRules): Strength {
  if (abv <= 0) return 'zero';
  if (abv <= rules.strengthBands.lightMax) return 'light';
  if (abv <= rules.strengthBands.mediumMax) return 'medium';
  return 'strong';
}

export function strengthDistance(a: Strength, b: Strength): number {
  return Math.abs(STRENGTH_ORDER.indexOf(a) - STRENGTH_ORDER.indexOf(b));
}
