// Test cases for the promptfoo suite. A JS generator instead of YAML so the llm-rubric (graded by a model
// that needs a key) can be left out of `EVALS_MOCK=1` runs.
const A = 'file://asserts.ts';

type Assert = { type: 'javascript'; value: string; config?: Record<string, unknown> };
const check = (fn: string, config?: Record<string, unknown>): Assert => ({
  type: 'javascript',
  value: `${A}:${fn}`,
  ...(config ? { config } : {}),
});

interface Case {
  recipeId: string;
  ingredientId: string;
  locale: 'en' | 'ru';
  asserts: Assert[];
  rubric?: string;
}

const cases: Case[] = [
  {
    recipeId: 'negroni',
    ingredientId: 'sweet-vermouth',
    locale: 'en',
    asserts: [check('firstIsOneOf', { ids: ['vermouth-amaro', 'ruby-port'] })],
  },
  {
    recipeId: 'manhattan',
    ingredientId: 'sweet-vermouth',
    locale: 'ru',
    asserts: [check('firstIsOneOf', { ids: ['vermouth-amaro', 'ruby-port'] })],
  },
  {
    recipeId: 'gin-and-tonic',
    ingredientId: 'tonic-water',
    locale: 'en',
    asserts: [
      check('fitIs', { id: 'soda-water', fit: 'workable' }),
      check('canSkipIs', { value: false }),
    ],
  },
  {
    recipeId: 'daiquiri',
    ingredientId: 'lime-juice',
    locale: 'ru',
    asserts: [check('firstIsWithFit', { id: 'lemon-juice', fit: 'close' })],
  },
  {
    recipeId: 'espresso-martini',
    ingredientId: 'coffee-liqueur',
    locale: 'ru',
    asserts: [check('includesAny', { ids: ['cold-brew-concentrate', 'espresso'] })],
  },
  {
    recipeId: 'mojito',
    ingredientId: 'mint',
    locale: 'en',
    asserts: [
      check('fitIs', { id: 'basil', fit: 'workable' }),
      check('canSkipIs', { value: false }),
    ],
  },
  {
    recipeId: 'margarita',
    ingredientId: 'orange-liqueur',
    locale: 'en',
    asserts: [check('includesAny', { ids: ['orange-amaro'] })],
  },
  {
    recipeId: 'whiskey-sour',
    ingredientId: 'bourbon',
    locale: 'ru',
    asserts: [check('firstIsOneOf', { ids: ['rye-whiskey'] })],
  },
  {
    recipeId: 'old-fashioned',
    ingredientId: 'aromatic-bitters',
    locale: 'en',
    asserts: [check('firstIsOneOf', { ids: ['orange-bitters', 'creole-bitters'] })],
  },
  {
    recipeId: 'mulled-wine',
    ingredientId: 'red-wine',
    locale: 'en',
    // White mulled wine is a known variant: either fit is fair, but it must be offered.
    asserts: [check('includesAny', { ids: ['white-wine'] })],
  },
  {
    recipeId: 'pina-colada',
    ingredientId: 'pineapple-juice',
    locale: 'en',
    asserts: [check('fitIs', { id: 'orange-juice', fit: 'workable' })],
  },
  {
    recipeId: 'amaretto-sour',
    ingredientId: 'amaretto',
    locale: 'en',
    asserts: [check('fitIs', { id: 'orgeat', fit: 'workable' })],
    rubric:
      'The notes warn that the drink becomes alcohol-free or much weaker and sweeter; no encouragement to drink more.',
  },
  {
    recipeId: 'dry-martini',
    ingredientId: 'dry-vermouth',
    locale: 'ru',
    asserts: [check('firstIsOneOf', { ids: ['bianco-vermouth', 'fino-sherry'] })],
  },
];

const mock = process.env.EVALS_MOCK === '1';

export function generateTests() {
  return cases.map((c) => ({
    description: `${c.recipeId} / ${c.ingredientId} / ${c.locale}`,
    vars: { recipeId: c.recipeId, ingredientId: c.ingredientId, locale: c.locale },
    assert: [...c.asserts, ...(c.rubric && !mock ? [{ type: 'llm-rubric', value: c.rubric }] : [])],
  }));
}
