import type {
  Amount,
  CatalogInput,
  Daypart,
  Flavor,
  Glass,
  Ingredient,
  Localized,
  Method,
  Occasion,
  WeatherFit,
} from '@sipclock/domain';

export type IngredientInput = CatalogInput['ingredients'][number];
export type RecipeInput = CatalogInput['recipes'][number];
type Line = RecipeInput['ingredients'][number];

export const L = (en: string, ru: string): Localized => ({ en, ru });

// ---- ingredients -----------------------------------------------------------

type Sub = readonly [id: string, en?: string, ru?: string];

export function ing(
  id: string,
  kind: Ingredient['kind'],
  abv: number,
  en: string,
  ru: string,
  opts: { parent?: string; from?: string; subs?: readonly Sub[]; staple?: boolean } = {},
): IngredientInput {
  const out: IngredientInput = { id, name: L(en, ru), kind, abv };
  if (opts.parent) out.parent = opts.parent;
  if (opts.from) out.madeFrom = opts.from;
  if (opts.subs) {
    out.substitutes = opts.subs.map(([sid, sen, sru]) =>
      sen && sru ? { id: sid, note: L(sen, sru) } : { id: sid },
    );
  }
  if (opts.staple) out.staple = true;
  return out;
}

// ---- recipe lines ----------------------------------------------------------

type Flags = { optional?: boolean };

const line = (
  ingredient: string,
  amount: Amount,
  flags: Flags & { garnish?: boolean } = {},
): Line => ({
  ingredient,
  amount,
  ...(flags.optional ? { optional: true } : {}),
  ...(flags.garnish ? { garnish: true } : {}),
});

export const ml = (id: string, value: number, f?: Flags) => line(id, { unit: 'ml', value }, f);
export const dash = (id: string, value: number, f?: Flags) => line(id, { unit: 'dash', value }, f);
export const bsp = (id: string, value: number, f?: Flags) =>
  line(id, { unit: 'barspoon', value }, f);
export const top = (id: string, estimateMl: number, f?: Flags) =>
  line(id, { unit: 'top', estimateMl }, f);
export const fill = (id: string) => line(id, { unit: 'fill' });
export const pc = (id: string, value: number, noun?: Localized, f?: Flags) =>
  line(id, noun ? { unit: 'piece', value, noun } : { unit: 'piece', value }, f);
/** Garnish: always optional. */
export const garnish = (id: string, amount: Amount = { unit: 'piece', value: 1 }) =>
  line(id, amount, { optional: true, garnish: true });

// ---- recipes ---------------------------------------------------------------

type Pair = readonly [en: string, ru: string];

export function recipe(r: {
  id: string;
  name: Pair;
  desc: Pair;
  glass: Glass;
  method: Method;
  ingredients: Line[];
  steps: Pair[];
  occasions: Occasion[];
  flavors: Flavor[];
  dayparts: Daypart[];
  weather: WeatherFit[];
  difficulty: 1 | 2 | 3;
  minutes: number;
  twin?: string;
  iba?: boolean;
}): RecipeInput {
  return {
    id: r.id,
    name: L(...r.name),
    description: L(...r.desc),
    glass: r.glass,
    method: r.method,
    ingredients: r.ingredients,
    steps: r.steps.map(([en, ru]) => L(en, ru)),
    tags: {
      occasions: r.occasions,
      flavors: r.flavors,
      dayparts: r.dayparts,
      weather: r.weather,
    },
    difficulty: r.difficulty,
    timeMinutes: r.minutes,
    ...(r.twin ? { zeroProofTwin: r.twin } : {}),
    ...(r.iba ? { iba: true } : {}),
  };
}
