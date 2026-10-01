import type {
  Availability,
  Catalog,
  Reason,
  Recipe,
  Recommendation,
  RecommendInput,
  ScoredRecipe,
  WeatherFit,
} from '@sipclock/domain';
import { estimateAbv, isAlcoholFree } from './abv.ts';
import { analyzeAvailability, availability, missingCount } from './availability.ts';
import { type CatalogIndex, createIndex } from './graph.ts';
import { unitJitter } from './random.ts';
import {
  daypartOf,
  defaultRules,
  isWeekend,
  type Rules,
  seasonOf,
  strengthDistance,
  strengthOf,
  weatherFits,
} from './rules.ts';

interface Weighted {
  reason: Reason;
  weight: number;
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function scoreRecipe(
  recipe: Recipe,
  abv: number,
  avail: Availability,
  input: RecommendInput,
  index: CatalogIndex,
  rules: Rules,
): ScoredRecipe {
  const w = rules.weights;
  const tags = recipe.tags;
  const daypart = daypartOf(input.moment.hour, rules);
  const gains: Weighted[] = [];
  const facts: Weighted[] = [];
  let score = 0;
  const gain = (weight: number, reason?: Reason) => {
    score += weight;
    if (reason && weight > 0) gains.push({ reason, weight });
  };

  // Daypart, and the weekend-brunch boost on top of it.
  if (daypart !== null && tags.dayparts.includes(daypart)) {
    gain(w.daypart, { code: 'daypart', daypart });
    if (daypart === 'brunch' && isWeekend(input.moment, rules)) {
      gain(w.weekendBrunch, { code: 'weekend' });
    }
  }

  // Weather: hot/cold/rainy give a reason; a mild day gives a smaller, reason-less nudge.
  if (input.weather) {
    const fits = weatherFits(input.weather, rules);
    const hit = fits.find(
      (f): f is 'hot' | 'cold' | 'rainy' => f !== 'mild' && tags.weather.includes(f),
    );
    if (hit) gain(w.weather, { code: 'weather', fit: hit });
    else if (fits.includes('mild') && tags.weather.includes('mild')) gain(w.weatherMild);
  }

  // Season: derived from the weather tags the season implies (see Rules.seasonFits).
  const season = seasonOf(input.moment.month, input.moment.hemisphere);
  const seasonFits: readonly WeatherFit[] = rules.seasonFits[season];
  if (seasonFits.some((f) => tags.weather.includes(f))) {
    gain(w.season, { code: 'season', season });
  }

  if (input.occasion && tags.occasions.includes(input.occasion)) {
    gain(w.occasion, { code: 'occasion', occasion: input.occasion });
  }

  if (input.taste) {
    const flavors = input.taste.flavors.filter((f, i, all) => all.indexOf(f) === i);
    const matched = flavors.filter((f) => tags.flavors.includes(f));
    if (matched.length > 0) {
      gain(Math.min(w.tasteMax, matched.length * w.tastePerFlavor), {
        code: 'taste',
        flavors: matched,
      });
    }
    if (input.taste.strength) {
      const dist = strengthDistance(input.taste.strength, strengthOf(abv, rules));
      gain(w.strengthMatch - w.strengthStep * dist);
    }
  }

  if (input.alcoholFree && abv === 0) {
    facts.push({ reason: { code: 'alcohol-free' }, weight: w.factWeight + 1 });
  }

  // Availability.
  if (avail.status === 'ready' || avail.status === 'swap') {
    const detail = analyzeAvailability(recipe, input.bar ?? [], index);
    const pts = avail.status === 'ready' ? w.availabilityReady : w.availabilitySwap;
    gain(
      pts,
      detail.present.length > 0 ? { code: 'in-bar', ingredients: detail.present } : undefined,
    );
    if (avail.status === 'swap') {
      for (const s of avail.swaps) {
        facts.push({ reason: { code: 'swap', need: s.need, use: s.use }, weight: w.factWeight });
      }
    }
  } else if (avail.status === 'missing') {
    score -= w.availabilityMissing * avail.missing.length;
    facts.push({ reason: { code: 'missing', ingredients: avail.missing }, weight: w.factWeight });
    for (const s of avail.swaps) {
      facts.push({
        reason: { code: 'swap', need: s.need, use: s.use },
        weight: w.factWeight - 0.1,
      });
    }
  }

  // Recently shown drinks are pushed down, decaying with position in `recent`.
  const pos = input.recent?.indexOf(recipe.id) ?? -1;
  if (pos >= 0) score -= rules.recent.penalty * rules.recent.decay ** pos;

  score += rules.jitter * unitJitter(input.seed, recipe.id);

  // Facts (swap/missing/alcohol-free) are always shown; the rest fills the remaining slots by weight.
  const byWeight = (a: Weighted, b: Weighted) => b.weight - a.weight;
  const shownFacts = [...facts].sort(byWeight).slice(0, rules.maxReasons);
  const rest = [...gains].sort(byWeight).slice(0, rules.maxReasons - shownFacts.length);
  const reasons = [...shownFacts, ...rest].sort(byWeight).map((x) => x.reason);

  return { recipeId: recipe.id, score: round4(score), abv, availability: avail, reasons };
}

const isMissing = (c: ScoredRecipe) => c.availability.status === 'missing';

function compareScored(a: ScoredRecipe, b: ScoredRecipe): number {
  if (a.score !== b.score) return b.score - a.score;
  return a.recipeId < b.recipeId ? -1 : a.recipeId > b.recipeId ? 1 : 0;
}

/**
 * Diversity rules for the alternatives (see docs): at most one `missing` (discovery) alternative,
 * unless the pick itself is `missing` (then every candidate is); and, when the user did not ask for
 * alcohol-free, the last slot goes to the best alcohol-free candidate if the top ones have none.
 */
function selectAlternatives(
  rest: ScoredRecipe[],
  count: number,
  wantZeroProof: boolean,
  capMissing: boolean,
): ScoredRecipe[] {
  if (count <= 0) return [];
  const eligible: ScoredRecipe[] = [];
  let missing = 0;
  for (const c of rest) {
    if (isMissing(c) && capMissing) {
      if (missing >= 1) continue;
      missing++;
    }
    eligible.push(c);
  }
  const top = eligible.slice(0, count);
  if (!wantZeroProof || top.some((c) => c.abv === 0)) return top;
  const zero = rest.find((c) => c.abv === 0 && !top.includes(c));
  if (!zero) return top;
  // A zero-proof drink that is missing something takes the slot of the missing one, keeping the cap.
  const missingAt = capMissing && isMissing(zero) ? top.findIndex(isMissing) : -1;
  const kept = missingAt >= 0 ? top.filter((_, k) => k !== missingAt) : top.slice(0, count - 1);
  return [...kept, zero];
}

export function recommend(
  input: RecommendInput,
  catalog: Catalog,
  rules: Rules = defaultRules,
): Recommendation {
  const index = createIndex(catalog);
  const scored: ScoredRecipe[] = [];
  for (const recipe of catalog.recipes) {
    if (input.alcoholFree && !isAlcoholFree(recipe, index)) continue;
    const abv = estimateAbv(recipe, index);
    const avail = availability(recipe, input.bar, index);
    scored.push(scoreRecipe(recipe, abv, avail, input, index, rules));
  }
  const withinCap = scored.filter((c) => missingCount(c.availability) <= rules.maxMissing);
  // A tiny or empty bar can rule out everything; then rank the whole catalog rather than show nothing.
  const candidates = withinCap.length > 0 ? withinCap : scored;
  candidates.sort(compareScored);

  const pick = candidates.find((c) => !isMissing(c)) ?? candidates[0] ?? null;
  const rest = candidates.filter((c) => c !== pick);
  const count = Math.max(0, Math.floor(input.alternatives ?? 3));
  const alternatives = selectAlternatives(
    rest,
    count,
    !input.alcoholFree,
    pick !== null && !isMissing(pick),
  );

  return {
    pick,
    alternatives,
    catalogVersion: catalog.version,
    rulesVersion: rules.version,
  };
}
