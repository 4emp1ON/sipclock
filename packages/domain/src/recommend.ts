import type { Daypart, Flavor, Occasion } from './catalog.ts';

// Contract of the recommendation engine (docs/adr/0003): a pure, deterministic function of its inputs.

/** Local wall-clock moment the pick is for. Kept as plain fields so the engine never touches time zones. */
export interface Moment {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  /** 0–23 */
  hour: number;
  minute: number;
  hemisphere: 'north' | 'south';
}

export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'snow';

export interface Weather {
  tempC: number;
  condition: WeatherCondition;
}

export type Strength = 'zero' | 'light' | 'medium' | 'strong';

export interface TasteProfile {
  flavors: Flavor[];
  strength?: Strength;
}

export interface RecommendInput {
  moment: Moment;
  occasion?: Occasion;
  /** `null` when the user has not shared a location or weather is unavailable. */
  weather: Weather | null;
  /** Ingredient ids the user has at home. `null` = bar unknown: availability is not scored. */
  bar: string[] | null;
  taste?: TasteProfile;
  alcoholFree?: boolean;
  /** Recipe ids shown or made recently, most recent first; the engine avoids repeating them. */
  recent?: string[];
  /** Makes "Another idea" and ties reproducible. */
  seed: number;
  /** Number of alternatives after the pick. Default 3. */
  alternatives?: number;
}

export type Availability =
  | { status: 'ready' }
  | { status: 'swap'; swaps: { need: string; use: string }[] }
  | { status: 'missing'; missing: string[]; swaps: { need: string; use: string }[] }
  | { status: 'unknown' };

/** Machine-readable reasons; apps turn them into localized sentences. Ordered by weight, strongest first. */
export type Reason =
  | { code: 'daypart'; daypart: Daypart }
  | { code: 'weekend' }
  | { code: 'weather'; fit: 'hot' | 'cold' | 'rainy' }
  | { code: 'season'; season: 'spring' | 'summer' | 'autumn' | 'winter' }
  | { code: 'occasion'; occasion: Occasion }
  | { code: 'taste'; flavors: Flavor[] }
  | { code: 'in-bar'; ingredients: string[] }
  | { code: 'swap'; need: string; use: string }
  | { code: 'missing'; ingredients: string[] }
  | { code: 'alcohol-free' };

export interface ScoredRecipe {
  recipeId: string;
  score: number;
  /** Estimated ABV of the finished drink, percent, rounded. */
  abv: number;
  availability: Availability;
  reasons: Reason[];
}

export interface Recommendation {
  pick: ScoredRecipe | null;
  alternatives: ScoredRecipe[];
  catalogVersion: string;
  rulesVersion: string;
}
