export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Ingredient {
  name: string;
  amount: string;
}

export interface Recipe {
  slug: string;
  name: string;
  /** Glass/style, e.g. "Highball". */
  kind: string;
  /** Flavour profile shown next to the kind, e.g. "Fresh". */
  profile: string;
  description: string;
  abv: number;
  minutes: number;
  difficulty: Difficulty;
  glass: string;
  yield: string;
  ingredients: Ingredient[];
  steps: string[];
  keywords: string[];
}

export const recipes: readonly Recipe[] = [
  {
    slug: 'gin-and-tonic',
    name: 'Gin & Tonic',
    kind: 'Highball',
    profile: 'Fresh',
    description:
      'A two-minute highball of London dry gin and tonic over ice with a lime wedge. Crisp, bitter and easy to scale.',
    abv: 9,
    minutes: 2,
    difficulty: 'easy',
    glass: 'Highball glass',
    yield: '1 serving',
    ingredients: [
      { name: 'London dry gin', amount: '50 ml' },
      { name: 'Tonic water', amount: '150 ml' },
      { name: 'Lime wedge', amount: '1' },
      { name: 'Ice', amount: 'to fill' },
    ],
    steps: [
      'Fill a highball glass to the top with ice.',
      'Pour in the gin.',
      'Top with chilled tonic water and stir once, gently.',
      'Squeeze the lime wedge over the drink and drop it in.',
    ],
    keywords: ['gin', 'highball', 'refreshing', 'easy cocktail'],
  },
  {
    slug: 'old-fashioned',
    name: 'Old Fashioned',
    kind: 'Rocks',
    profile: 'Strong',
    description:
      'Bourbon, sugar syrup and Angostura bitters stirred over ice and finished with orange peel. A slow, spirit-forward classic.',
    abv: 30,
    minutes: 3,
    difficulty: 'easy',
    glass: 'Rocks glass',
    yield: '1 serving',
    ingredients: [
      { name: 'Bourbon', amount: '60 ml' },
      { name: 'Sugar syrup', amount: '7.5 ml' },
      { name: 'Angostura bitters', amount: '2 dashes' },
      { name: 'Orange peel', amount: '1 strip' },
      { name: 'Ice', amount: 'to fill' },
    ],
    steps: [
      'Add the sugar syrup and bitters to a rocks glass.',
      'Add the bourbon and a few ice cubes, then stir for 20 seconds.',
      'Add a large ice cube.',
      'Express the orange peel over the glass, rub the rim and drop it in.',
    ],
    keywords: ['bourbon', 'whiskey', 'classic', 'stirred', 'strong'],
  },
];

export function getRecipe(slug: string): Recipe | undefined {
  return recipes.find((r) => r.slug === slug);
}
