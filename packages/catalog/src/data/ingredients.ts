import { type IngredientInput, ing } from './helpers.ts';

const spirits: IngredientInput[] = [
  ing('gin', 'spirit', 40, 'Gin', 'Джин', {
    subs: [['vodka', 'Less botanical, still works', 'Меньше трав, но подойдёт']],
  }),
  ing('london-dry-gin', 'spirit', 42, 'London dry gin', 'Лондонский сухой джин', { parent: 'gin' }),
  ing('vodka', 'spirit', 40, 'Vodka', 'Водка'),
  ing('rum', 'spirit', 40, 'Rum', 'Ром'),
  ing('white-rum', 'spirit', 40, 'White rum', 'Белый ром', { parent: 'rum' }),
  ing('dark-rum', 'spirit', 40, 'Dark rum', 'Тёмный ром', { parent: 'rum' }),
  ing('spiced-rum', 'spirit', 35, 'Spiced rum', 'Пряный ром', { parent: 'rum' }),
  ing('whisky', 'spirit', 40, 'Whisky', 'Виски'),
  ing('bourbon', 'spirit', 45, 'Bourbon', 'Бурбон', {
    parent: 'whisky',
    subs: [['rye-whiskey', 'Drier and spicier', 'Суше и пряннее']],
  }),
  ing('rye-whiskey', 'spirit', 45, 'Rye whiskey', 'Ржаной виски', {
    parent: 'whisky',
    subs: [['bourbon', 'Softer and sweeter', 'Мягче и слаще']],
  }),
  ing('scotch-whisky', 'spirit', 40, 'Scotch whisky', 'Шотландский виски', { parent: 'whisky' }),
  ing('irish-whiskey', 'spirit', 40, 'Irish whiskey', 'Ирландский виски', { parent: 'whisky' }),
  ing('tequila', 'spirit', 40, 'Tequila', 'Текила'),
  ing('blanco-tequila', 'spirit', 40, 'Blanco tequila', 'Текила бланко', { parent: 'tequila' }),
  ing('reposado-tequila', 'spirit', 40, 'Reposado tequila', 'Текила репосадо', {
    parent: 'tequila',
  }),
  ing('mezcal', 'spirit', 42, 'Mezcal', 'Мескаль', {
    subs: [['tequila', 'Loses the smoke', 'Без дымного оттенка']],
  }),
  ing('cachaca', 'spirit', 40, 'Cachaça', 'Кашаса', {
    subs: [['white-rum', 'Close enough, less grassy', 'Похоже, но менее травянисто']],
  }),
  ing('brandy', 'spirit', 40, 'Brandy', 'Бренди'),
  ing('cognac', 'spirit', 40, 'Cognac', 'Коньяк', { parent: 'brandy' }),
];

const liqueurs: IngredientInput[] = [
  ing('orange-liqueur', 'liqueur', 30, 'Orange liqueur', 'Апельсиновый ликёр'),
  ing('red-bitter-aperitif', 'liqueur', 25, 'Red bitter aperitif', 'Красный горький аперитив', {
    subs: [['orange-aperitivo', 'Sweeter and lighter', 'Слаще и легче']],
  }),
  ing('orange-aperitivo', 'liqueur', 11, 'Orange aperitivo', 'Апельсиновый аперитиво', {
    subs: [['red-bitter-aperitif', 'More bitter and stronger', 'Горче и крепче']],
  }),
  ing('coffee-liqueur', 'liqueur', 20, 'Coffee liqueur', 'Кофейный ликёр'),
  ing('cream-liqueur', 'liqueur', 17, 'Cream liqueur', 'Сливочный ликёр'),
  ing('maraschino-liqueur', 'liqueur', 32, 'Maraschino liqueur', 'Ликёр мараскино'),
  ing('elderflower-liqueur', 'liqueur', 20, 'Elderflower liqueur', 'Ликёр из бузины'),
  ing('green-herbal-liqueur', 'liqueur', 55, 'Green herbal liqueur', 'Зелёный травяной ликёр'),
  ing('violet-liqueur', 'liqueur', 22, 'Violet liqueur', 'Фиалковый ликёр'),
];

const wines: IngredientInput[] = [
  ing('sweet-vermouth', 'wine', 16, 'Sweet vermouth', 'Сладкий вермут'),
  ing('dry-vermouth', 'wine', 18, 'Dry vermouth', 'Сухой вермут'),
  ing('sparkling-wine', 'wine', 11.5, 'Sparkling wine', 'Игристое вино', {
    subs: [['soda-water', 'Lighter, alcohol-free version', 'Легче, без алкоголя']],
  }),
  ing('red-wine', 'wine', 13, 'Red wine', 'Красное вино'),
];

const bitters: IngredientInput[] = [
  ing('aromatic-bitters', 'bitters', 44, 'Aromatic bitters', 'Ароматический биттер'),
  ing('orange-bitters', 'bitters', 40, 'Orange bitters', 'Апельсиновый биттер', {
    subs: [['aromatic-bitters']],
  }),
];

const mixers: IngredientInput[] = [
  ing('ginger-beer', 'mixer', 0, 'Ginger beer', 'Имбирное пиво', {
    subs: [['ginger-ale', 'Milder, less spicy', 'Мягче, менее пряный']],
  }),
  ing('tonic-water', 'mixer', 0, 'Tonic water', 'Тоник'),
  ing('soda-water', 'mixer', 0, 'Soda water', 'Содовая'),
  ing('cola', 'mixer', 0, 'Cola', 'Кола'),
  ing('grapefruit-soda', 'mixer', 0, 'Grapefruit soda', 'Грейпфрутовая газировка', {
    subs: [['grapefruit-juice', 'Add soda water on top', 'Добавьте содовую сверху']],
  }),
  ing('ginger-ale', 'mixer', 0, 'Ginger ale', 'Имбирный эль', {
    subs: [['ginger-beer', 'Spicier', 'Пряннее']],
  }),
];

const juices: IngredientInput[] = [
  ing('lime-juice', 'juice', 0, 'Lime juice', 'Сок лайма', {
    from: 'lime',
    subs: [['lemon-juice', 'Slightly softer sourness', 'Кислинка чуть мягче']],
  }),
  ing('lemon-juice', 'juice', 0, 'Lemon juice', 'Лимонный сок', {
    from: 'lemon',
    subs: [['lime-juice', 'Sharper, a bit more bitter', 'Резче и чуть горчее']],
  }),
  ing('orange-juice', 'juice', 0, 'Orange juice', 'Апельсиновый сок', { from: 'orange' }),
  ing('grapefruit-juice', 'juice', 0, 'Grapefruit juice', 'Грейпфрутовый сок'),
  ing('cranberry-juice', 'juice', 0, 'Cranberry juice', 'Клюквенный морс'),
  ing('pineapple-juice', 'juice', 0, 'Pineapple juice', 'Ананасовый сок'),
  ing('tomato-juice', 'juice', 0, 'Tomato juice', 'Томатный сок'),
];

const fresh: IngredientInput[] = [
  ing('lime', 'fresh', 0, 'Lime', 'Лайм', {
    subs: [['lemon', 'Works the same way', 'Работает так же']],
  }),
  ing('lemon', 'fresh', 0, 'Lemon', 'Лимон', { subs: [['lime']] }),
  ing('orange', 'fresh', 0, 'Orange', 'Апельсин'),
  ing('mint', 'fresh', 0, 'Mint', 'Мята'),
  ing('cucumber', 'fresh', 0, 'Cucumber', 'Огурец'),
  ing('egg-white', 'fresh', 0, 'Egg white', 'Яичный белок'),
  ing('cocktail-cherry', 'fresh', 0, 'Cocktail cherry', 'Коктейльная вишня'),
  ing('green-olive', 'fresh', 0, 'Green olive', 'Зелёная оливка'),
  ing('celery-stalk', 'fresh', 0, 'Celery stalk', 'Стебель сельдерея'),
  ing('fresh-ginger', 'fresh', 0, 'Fresh ginger', 'Свежий имбирь'),
];

const syrups: IngredientInput[] = [
  ing('simple-syrup', 'syrup', 0, 'Simple syrup', 'Сахарный сироп', {
    from: 'sugar',
    subs: [['honey-syrup'], ['agave-syrup']],
  }),
  ing('honey-syrup', 'syrup', 0, 'Honey syrup', 'Медовый сироп', {
    from: 'honey',
    subs: [['simple-syrup']],
  }),
  ing('grenadine', 'syrup', 0, 'Grenadine', 'Гренадин', {
    subs: [['cranberry-juice', 'Less sweet, tarter', 'Менее сладко, кислее']],
  }),
  ing('agave-syrup', 'syrup', 0, 'Agave syrup', 'Сироп агавы', { subs: [['simple-syrup']] }),
  ing('demerara-syrup', 'syrup', 0, 'Demerara syrup', 'Сироп из тростникового сахара', {
    subs: [['simple-syrup']],
  }),
];

const dairy: IngredientInput[] = [
  ing('cream', 'dairy', 0, 'Cream', 'Сливки', {
    subs: [['milk', 'Thinner body', 'Менее плотная текстура']],
  }),
  ing('milk', 'dairy', 0, 'Milk', 'Молоко'),
];

const pantry: IngredientInput[] = [
  ing('sugar', 'pantry', 0, 'Sugar', 'Сахар'),
  ing('honey', 'pantry', 0, 'Honey', 'Мёд', { subs: [['honey-syrup'], ['simple-syrup']] }),
  ing('salt', 'pantry', 0, 'Salt', 'Соль'),
  ing('espresso', 'pantry', 0, 'Espresso', 'Эспрессо', {
    subs: [['brewed-coffee', 'Brew it extra strong', 'Заварите очень крепким']],
  }),
  ing('brewed-coffee', 'pantry', 0, 'Hot brewed coffee', 'Горячий чёрный кофе'),
  ing('celery-salt', 'pantry', 0, 'Celery salt', 'Сельдерейная соль', { subs: [['salt']] }),
  ing('worcestershire-style-sauce', 'pantry', 0, 'Worcestershire-style sauce', 'Вустерский соус'),
  ing('hot-sauce', 'pantry', 0, 'Hot pepper sauce', 'Острый перечный соус'),
  ing('black-pepper', 'pantry', 0, 'Black pepper', 'Чёрный перец'),
  ing('nutmeg', 'pantry', 0, 'Nutmeg', 'Мускатный орех'),
  ing('cinnamon-stick', 'pantry', 0, 'Cinnamon stick', 'Палочка корицы'),
  ing('cloves', 'pantry', 0, 'Cloves', 'Гвоздика'),
  ing('star-anise', 'pantry', 0, 'Star anise', 'Звёздчатый анис'),
  ing('coconut-cream', 'pantry', 0, 'Coconut cream', 'Кокосовые сливки'),
  ing('apple-juice', 'juice', 0, 'Apple juice', 'Яблочный сок'),
];

const staples: IngredientInput[] = [
  ing('ice', 'staple', 0, 'Ice', 'Лёд', { staple: true }),
  ing('water', 'staple', 0, 'Water', 'Вода', { staple: true }),
];

export const ingredients: IngredientInput[] = [
  ...spirits,
  ...liqueurs,
  ...wines,
  ...bitters,
  ...mixers,
  ...juices,
  ...fresh,
  ...syrups,
  ...dairy,
  ...pantry,
  ...staples,
];
