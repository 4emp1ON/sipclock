import { type Catalog, type CatalogInput, catalog } from '@sipclock/domain';

type Ing = CatalogInput['ingredients'][number];
type Rec = CatalogInput['recipes'][number];
type Item = Rec['ingredients'][number];

const n = (en: string, ru: string) => ({ en, ru });

const ing = (
  id: string,
  en: string,
  ru: string,
  kind: Ing['kind'],
  abv: number,
  extra: Partial<Ing> = {},
): Ing => ({ id, name: n(en, ru), kind, abv, ...extra });

const ml = (ingredient: string, value: number, extra: Partial<Item> = {}): Item => ({
  ingredient,
  amount: { unit: 'ml', value },
  ...extra,
});
const dash = (ingredient: string, value: number): Item => ({
  ingredient,
  amount: { unit: 'dash', value },
});
const spoon = (ingredient: string, value: number): Item => ({
  ingredient,
  amount: { unit: 'barspoon', value },
});
const top = (ingredient: string, estimateMl: number): Item => ({
  ingredient,
  amount: { unit: 'top', estimateMl },
});
const ice: Item = { ingredient: 'ice', amount: { unit: 'fill' } };
const garnish = (ingredient: string): Item => ({
  ingredient,
  amount: { unit: 'piece', value: 1 },
  garnish: true,
});

const recipe = (
  id: string,
  en: string,
  ru: string,
  glass: Rec['glass'],
  method: Rec['method'],
  ingredients: Item[],
  tags: {
    o: Rec['tags']['occasions'];
    f: Rec['tags']['flavors'];
    d: Rec['tags']['dayparts'];
    w: Rec['tags']['weather'];
  },
  extra: Partial<Rec> = {},
): Rec => ({
  id,
  name: n(en, ru),
  description: n(`${en}.`, `${ru}.`),
  glass,
  method,
  ingredients,
  steps: [n('Mix and serve.', 'Смешайте и подайте.')],
  tags: { occasions: tags.o, flavors: tags.f, dayparts: tags.d, weather: tags.w },
  difficulty: 1,
  timeMinutes: 3,
  ...extra,
});

const input: CatalogInput = {
  version: '2026.09.29',
  ingredients: [
    ing('ice', 'Ice', 'Лёд', 'staple', 0, { staple: true }),
    ing('water', 'Water', 'Вода', 'staple', 0, { staple: true }),
    ing('gin', 'Gin', 'Джин', 'spirit', 40),
    ing('london-dry-gin', 'London dry gin', 'Лондонский сухой джин', 'spirit', 40, {
      parent: 'gin',
    }),
    ing('vodka', 'Vodka', 'Водка', 'spirit', 40),
    ing('white-rum', 'White rum', 'Белый ром', 'spirit', 40),
    ing('bourbon', 'Bourbon', 'Бурбон', 'spirit', 40),
    ing('tequila', 'Tequila', 'Текила', 'spirit', 40),
    ing('campari', 'Campari', 'Кампари', 'liqueur', 25),
    ing('triple-sec', 'Triple sec', 'Трипл сек', 'liqueur', 30),
    ing('sweet-vermouth', 'Sweet vermouth', 'Сладкий вермут', 'wine', 18),
    ing('sparkling-wine', 'Sparkling wine', 'Игристое вино', 'wine', 11),
    ing('angostura-bitters', 'Aromatic bitters', 'Ароматические биттеры', 'bitters', 44),
    ing('simple-syrup', 'Simple syrup', 'Сахарный сироп', 'syrup', 0),
    ing('sugar', 'Sugar', 'Сахар', 'pantry', 0, { substitutes: [{ id: 'simple-syrup' }] }),
    ing('honey', 'Honey', 'Мёд', 'pantry', 0, { substitutes: [{ id: 'simple-syrup' }] }),
    ing('lime', 'Lime', 'Лайм', 'fresh', 0, { substitutes: [{ id: 'lemon' }] }),
    ing('lemon', 'Lemon', 'Лимон', 'fresh', 0, { substitutes: [{ id: 'lime' }] }),
    ing('mint', 'Mint', 'Мята', 'fresh', 0),
    ing('orange-juice', 'Orange juice', 'Апельсиновый сок', 'juice', 0.3),
    ing('tonic-water', 'Tonic water', 'Тоник', 'mixer', 0),
    ing('soda-water', 'Soda water', 'Содовая', 'mixer', 0),
    ing('ginger-beer', 'Ginger beer', 'Имбирное пиво', 'mixer', 0.5),
    ing('cola', 'Cola', 'Кола', 'mixer', 0),
    ing('orange', 'Orange', 'Апельсин', 'fresh', 0),
  ],
  recipes: [
    recipe(
      'gin-and-tonic',
      'Gin & Tonic',
      'Джин-тоник',
      'highball',
      'build',
      [ml('gin', 50), top('tonic-water', 150), ml('lime', 10), ice],
      {
        o: ['after-work', 'chill'],
        f: ['bitter', 'fresh', 'herbal'],
        d: ['aperitif', 'evening'],
        w: ['hot', 'mild'],
      },
    ),
    recipe(
      'negroni',
      'Negroni',
      'Негрони',
      'rocks',
      'stir',
      [ml('gin', 30), ml('campari', 30), ml('sweet-vermouth', 30), ice, garnish('orange')],
      {
        o: ['after-work', 'date'],
        f: ['bitter', 'boozy', 'herbal'],
        d: ['aperitif', 'evening'],
        w: ['cold', 'mild', 'rainy'],
      },
      { iba: true },
    ),
    recipe(
      'old-fashioned',
      'Old Fashioned',
      'Олд фэшн',
      'rocks',
      'stir',
      [ml('bourbon', 50), spoon('sugar', 1), dash('angostura-bitters', 2), ice],
      {
        o: ['date', 'chill'],
        f: ['boozy', 'bitter', 'sweet'],
        d: ['evening', 'late'],
        w: ['cold', 'rainy', 'mild'],
      },
      { iba: true },
    ),
    recipe(
      'daiquiri',
      'Daiquiri',
      'Дайкири',
      'coupe',
      'shake',
      [ml('white-rum', 60), ml('lime', 25), ml('simple-syrup', 15)],
      {
        o: ['party', 'date'],
        f: ['sour', 'fresh'],
        d: ['aperitif', 'evening'],
        w: ['hot', 'mild'],
      },
      { iba: true },
    ),
    recipe(
      'mojito',
      'Mojito',
      'Мохито',
      'highball',
      'muddle',
      [
        ml('white-rum', 50),
        ml('lime', 25),
        ml('simple-syrup', 15),
        ml('mint', 5),
        top('soda-water', 60),
        ice,
      ],
      {
        o: ['party', 'chill'],
        f: ['fresh', 'herbal', 'sour'],
        d: ['aperitif', 'evening'],
        w: ['hot'],
      },
      { zeroProofTwin: 'virgin-mojito', iba: true },
    ),
    recipe(
      'margarita',
      'Margarita',
      'Маргарита',
      'coupe',
      'shake',
      [ml('tequila', 50), ml('triple-sec', 25), ml('lime', 25)],
      { o: ['party'], f: ['sour', 'fresh'], d: ['aperitif', 'evening'], w: ['hot', 'mild'] },
      { iba: true },
    ),
    recipe(
      'whiskey-sour',
      'Whiskey Sour',
      'Виски сауэр',
      'rocks',
      'shake',
      [ml('bourbon', 50), ml('lemon', 25), ml('simple-syrup', 15), ice],
      { o: ['date', 'chill'], f: ['sour', 'sweet'], d: ['evening'], w: ['mild', 'cold'] },
      { iba: true },
    ),
    recipe(
      'hot-toddy',
      'Hot Toddy',
      'Хот тодди',
      'irish-coffee',
      'heat',
      [ml('bourbon', 45), ml('honey', 15), ml('lemon', 15), top('water', 120)],
      {
        o: ['chill', 'date'],
        f: ['spicy', 'sweet', 'sour'],
        d: ['late', 'evening'],
        w: ['cold', 'rainy'],
      },
    ),
    recipe(
      'mimosa',
      'Mimosa',
      'Мимоза',
      'flute',
      'build',
      [ml('sparkling-wine', 90), ml('orange-juice', 60)],
      {
        o: ['brunch', 'party'],
        f: ['fruity', 'fresh', 'sweet'],
        d: ['brunch'],
        w: ['mild', 'hot'],
      },
      { iba: true },
    ),
    recipe(
      'americano',
      'Americano',
      'Американо',
      'highball',
      'build',
      [ml('campari', 30), ml('sweet-vermouth', 30), top('soda-water', 60), ice],
      { o: ['after-work', 'chill'], f: ['bitter', 'herbal'], d: ['aperitif'], w: ['mild', 'hot'] },
      { iba: true },
    ),
    recipe(
      'moscow-mule',
      'Moscow Mule',
      'Московский мул',
      'copper-mug',
      'build',
      [ml('vodka', 50), ml('lime', 15), top('ginger-beer', 120), ice],
      {
        o: ['party', 'after-work'],
        f: ['spicy', 'fresh'],
        d: ['aperitif', 'evening'],
        w: ['mild', 'hot', 'rainy'],
      },
      { iba: true },
    ),
    recipe(
      'virgin-mojito',
      'Virgin Mojito',
      'Безалкогольный мохито',
      'highball',
      'muddle',
      [ml('lime', 25), ml('simple-syrup', 15), ml('mint', 5), top('soda-water', 110), ice],
      {
        o: ['party', 'chill'],
        f: ['fresh', 'herbal', 'sour'],
        d: ['aperitif', 'evening'],
        w: ['hot', 'mild'],
      },
    ),
    recipe(
      'ginger-lime-fizz',
      'Ginger Lime Fizz',
      'Имбирно-лаймовый физз',
      'highball',
      'build',
      [ml('lime', 20), ml('simple-syrup', 10), top('ginger-beer', 120), ice],
      {
        o: ['chill', 'after-work'],
        f: ['spicy', 'fresh', 'sour'],
        d: ['aperitif', 'evening'],
        w: ['hot', 'mild', 'rainy'],
      },
    ),
    recipe(
      'hot-honey-lemon',
      'Hot Honey Lemon',
      'Горячий мёд с лимоном',
      'irish-coffee',
      'heat',
      [ml('honey', 15), ml('lemon', 15), top('water', 200)],
      {
        o: ['chill'],
        f: ['sweet', 'sour'],
        d: ['late', 'evening'],
        w: ['cold', 'rainy'],
      },
    ),
  ],
};

/** Small hand-made catalog for engine tests; validated against the real domain schema. */
export const fixtureCatalog: Catalog = catalog.parse(input);
