import { type IngredientInput, ing } from './helpers.ts';

const spirits: IngredientInput[] = [
  ing('gin', 'spirit', 40, 'Gin', 'Джин', {
    subs: [['vodka', 'Less botanical, still works', 'Меньше трав, но подойдёт']],
  }),
  ing('london-dry-gin', 'spirit', 42, 'London dry gin', 'Лондонский сухой джин', { parent: 'gin' }),
  ing('vodka', 'spirit', 40, 'Vodka', 'Водка', {
    subs: [
      ['white-rum', 'A touch sweeter', 'Чуть слаще'],
      ['gin', 'Adds juniper and herbs', 'Добавит можжевельник и травы'],
    ],
  }),
  ing('rum', 'spirit', 40, 'Rum', 'Ром', {
    subs: [['cachaca', 'Grassier and funkier', 'Травянистее и ярче']],
  }),
  ing('white-rum', 'spirit', 40, 'White rum', 'Белый ром', {
    parent: 'rum',
    loose: [['vodka', 'Cleaner, no cane sweetness', 'Чище, без тростниковой сладости']],
  }),
  ing('dark-rum', 'spirit', 40, 'Dark rum', 'Тёмный ром', {
    parent: 'rum',
    loose: [['bourbon', 'Drier, more oak', 'Суше, больше дуба']],
  }),
  ing('spiced-rum', 'spirit', 35, 'Spiced rum', 'Пряный ром', { parent: 'rum' }),
  ing('whisky', 'spirit', 40, 'Whisky', 'Виски', {
    subs: [['brandy', 'Fruitier and rounder', 'Фруктовее и округлее']],
  }),
  ing('bourbon', 'spirit', 45, 'Bourbon', 'Бурбон', {
    parent: 'whisky',
    subs: [['rye-whiskey', 'Drier and spicier', 'Суше и прянее']],
  }),
  ing('rye-whiskey', 'spirit', 45, 'Rye whiskey', 'Ржаной виски', {
    parent: 'whisky',
    subs: [['bourbon', 'Softer and sweeter', 'Мягче и слаще']],
  }),
  ing('scotch-whisky', 'spirit', 40, 'Scotch whisky', 'Шотландский виски', {
    parent: 'whisky',
    subs: [['irish-whiskey', 'Lighter and smoother', 'Легче и мягче']],
  }),
  ing('irish-whiskey', 'spirit', 40, 'Irish whiskey', 'Ирландский виски', { parent: 'whisky' }),
  ing('tequila', 'spirit', 40, 'Tequila', 'Текила', {
    subs: [['mezcal', 'Adds smoke', 'Добавит дымок']],
  }),
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
  ing('brandy', 'spirit', 40, 'Brandy', 'Бренди', {
    subs: [
      ['bourbon', 'Spicier, more oak', 'Прянее, больше дуба'],
      ['dark-rum', 'Sweeter, with molasses', 'Слаще, с нотой патоки'],
    ],
  }),
  ing('cognac', 'spirit', 40, 'Cognac', 'Коньяк', { parent: 'brandy' }),
  ing('old-tom-gin', 'spirit', 43, 'Old Tom gin', 'Джин олд том', { parent: 'gin' }),
  ing('canadian-whisky', 'spirit', 40, 'Canadian whisky', 'Канадский виски', { parent: 'whisky' }),
  ing('peated-scotch-whisky', 'spirit', 46, 'Peated Scotch whisky', 'Торфяной шотландский виски', {
    parent: 'scotch-whisky',
    subs: [['mezcal', 'Smoke from agave, not peat', 'Дымок от агавы, а не от торфа']],
  }),
  ing('apple-brandy', 'spirit', 40, 'Apple brandy', 'Яблочный бренди', {
    parent: 'brandy',
    subs: [['cognac', 'Grape instead of apple', 'Виноградный вместо яблочного']],
  }),
  ing('pisco', 'spirit', 40, 'Pisco', 'Писко', {
    subs: [['brandy', 'Rounder, less floral', 'Округлее и менее цветочный']],
  }),
  ing('absinthe', 'spirit', 60, 'Absinthe', 'Абсент', {
    subs: [['green-herbal-liqueur', 'Sweeter, herbal, no anise', 'Слаще, травяной, без аниса']],
  }),
];

const liqueurs: IngredientInput[] = [
  ing('orange-liqueur', 'liqueur', 30, 'Orange liqueur', 'Апельсиновый ликёр', {
    subs: [['orange-amaro', 'Less sweet, gently bitter', 'Менее сладкий, с лёгкой горечью']],
  }),
  ing('red-bitter-aperitif', 'liqueur', 25, 'Red bitter aperitif', 'Красный горький аперитив', {
    subs: [['orange-aperitivo', 'Sweeter and lighter', 'Слаще и легче']],
  }),
  ing('orange-aperitivo', 'liqueur', 11, 'Orange aperitivo', 'Апельсиновый аперитиво', {
    subs: [['red-bitter-aperitif', 'More bitter and stronger', 'Горче и крепче']],
  }),
  ing('coffee-liqueur', 'liqueur', 20, 'Coffee liqueur', 'Кофейный ликёр', {
    subs: [
      [
        'cold-brew-concentrate',
        'Add sugar syrup; lower in alcohol',
        'Добавьте сахарный сироп; напиток станет слабее',
      ],
    ],
    loose: [
      [
        'espresso',
        'Add sugar syrup; lower in alcohol',
        'Добавьте сахарный сироп; напиток станет слабее',
      ],
    ],
  }),
  ing('cream-liqueur', 'liqueur', 17, 'Cream liqueur', 'Сливочный ликёр'),
  ing('maraschino-liqueur', 'liqueur', 32, 'Maraschino liqueur', 'Ликёр мараскино', {
    subs: [['cherry-liqueur', 'Fruitier and sweeter', 'Фруктовее и слаще']],
    loose: [['orange-liqueur', 'Orange instead of cherry', 'Апельсин вместо вишни']],
  }),
  ing('elderflower-liqueur', 'liqueur', 20, 'Elderflower liqueur', 'Ликёр из бузины', {
    subs: [
      [
        'elderflower-syrup',
        'Alcohol-free and sweeter: use less',
        'Без алкоголя и слаще: возьмите меньше',
      ],
    ],
  }),
  ing('green-herbal-liqueur', 'liqueur', 55, 'Green herbal liqueur', 'Зелёный травяной ликёр', {
    subs: [['yellow-herbal-liqueur', 'Softer and sweeter', 'Мягче и слаще']],
  }),
  ing('violet-liqueur', 'liqueur', 22, 'Violet liqueur', 'Фиалковый ликёр'),
  ing('amaretto', 'liqueur', 24, 'Amaretto', 'Амаретто', {
    loose: [
      ['orgeat', 'Alcohol-free and sweeter: use less', 'Без алкоголя и слаще: возьмите меньше'],
    ],
  }),
  ing('amaro', 'liqueur', 30, 'Amaro', 'Амаро', {
    subs: [['red-bitter-aperitif', 'Brighter and more bitter', 'Ярче и горче']],
  }),
  ing('artichoke-amaro', 'liqueur', 16.5, 'Artichoke amaro', 'Амаро на артишоке', {
    subs: [['amaro']],
  }),
  ing('orange-amaro', 'liqueur', 21, 'Orange amaro', 'Апельсиновый амаро', { subs: [['amaro']] }),
  ing('vermouth-amaro', 'liqueur', 22, 'Vermouth amaro', 'Вермутный амаро', {
    subs: [['sweet-vermouth', 'Less bitter', 'Менее горький']],
  }),
  ing('fernet', 'liqueur', 39, 'Fernet', 'Фернет', {
    subs: [['amaro', 'Softer, less minty', 'Мягче, без мятного холодка']],
  }),
  ing('gentian-liqueur', 'liqueur', 16, 'Gentian liqueur', 'Горечавковый ликёр', {
    subs: [
      [
        'red-bitter-aperitif',
        'Turns the drink red and fruitier',
        'Напиток станет красным и фруктовее',
      ],
    ],
  }),
  ing('herbal-honey-liqueur', 'liqueur', 40, 'Herbal honey liqueur', 'Травяной медовый ликёр', {
    subs: [['yellow-herbal-liqueur', 'Sharper, less honeyed', 'Резче, меньше мёда']],
  }),
  ing('honey-whisky-liqueur', 'liqueur', 40, 'Honey whisky liqueur', 'Медовый ликёр на виски', {
    subs: [['herbal-honey-liqueur', 'More herbal, no whisky note', 'Больше трав, без ноты виски']],
  }),
  ing('yellow-herbal-liqueur', 'liqueur', 40, 'Yellow herbal liqueur', 'Жёлтый травяной ликёр', {
    subs: [
      ['herbal-honey-liqueur', 'Rounder and sweeter', 'Округлее и слаще'],
      ['green-herbal-liqueur', 'Stronger and sharper', 'Крепче и резче'],
    ],
  }),
  ing('cherry-liqueur', 'liqueur', 24, 'Cherry liqueur', 'Вишнёвый ликёр', {
    subs: [['maraschino-liqueur', 'Drier, less fruity', 'Суше, менее фруктовый']],
  }),
  ing(
    'cassis-liqueur',
    'liqueur',
    17,
    'Blackcurrant liqueur (cassis)',
    'Смородиновый ликёр (кассис)',
    {
      subs: [['raspberry-liqueur'], ['blackberry-liqueur']],
    },
  ),
  ing('raspberry-liqueur', 'liqueur', 16, 'Raspberry liqueur', 'Малиновый ликёр', {
    subs: [['blackberry-liqueur'], ['cassis-liqueur']],
  }),
  ing('blackberry-liqueur', 'liqueur', 16, 'Blackberry liqueur', 'Ежевичный ликёр', {
    subs: [['cassis-liqueur'], ['raspberry-liqueur']],
  }),
  ing('strawberry-liqueur', 'liqueur', 18, 'Strawberry liqueur', 'Клубничный ликёр', {
    subs: [['raspberry-liqueur']],
  }),
  ing('melon-liqueur', 'liqueur', 20, 'Melon liqueur', 'Дынный ликёр'),
  ing('passion-fruit-liqueur', 'liqueur', 20, 'Passion fruit liqueur', 'Ликёр маракуйи', {
    subs: [
      [
        'passion-fruit-syrup',
        'Alcohol-free and sweeter: use less',
        'Без алкоголя и слаще: возьмите меньше',
      ],
    ],
  }),
  ing('mint-liqueur', 'liqueur', 24, 'Mint liqueur', 'Мятный ликёр'),
  ing('cacao-liqueur', 'liqueur', 24, 'Dark cacao liqueur', 'Тёмный какао-ликёр', {
    subs: [['white-cacao-liqueur']],
  }),
  ing('white-cacao-liqueur', 'liqueur', 24, 'White cacao liqueur', 'Белый какао-ликёр', {
    subs: [['cacao-liqueur', 'Turns the drink brown', 'Напиток станет коричневым']],
  }),
  ing('egg-liqueur', 'liqueur', 17, 'Egg liqueur', 'Яичный ликёр', { subs: [['cream-liqueur']] }),
  ing('vanilla-anise-liqueur', 'liqueur', 30, 'Vanilla-anise liqueur', 'Ванильно-анисовый ликёр'),
  ing('falernum', 'liqueur', 11, 'Falernum', 'Фалернум', {
    subs: [
      ['simple-syrup', 'Add a dash of bitters and lime zest', 'Добавьте дэш биттера и цедру лайма'],
    ],
  }),
];

const wines: IngredientInput[] = [
  ing('sweet-vermouth', 'wine', 16, 'Sweet vermouth', 'Сладкий вермут', {
    subs: [['vermouth-amaro', 'More bitter', 'Горче']],
    loose: [['ruby-port', 'Fruitier, no bitterness', 'Фруктовее, без горчинки']],
  }),
  ing('dry-vermouth', 'wine', 18, 'Dry vermouth', 'Сухой вермут', {
    subs: [
      ['bianco-vermouth', 'Sweeter: use a little less', 'Слаще: возьмите чуть меньше'],
      ['fino-sherry', 'Nuttier and saltier', 'Ореховее и солонее'],
    ],
  }),
  ing('sparkling-wine', 'wine', 11.5, 'Sparkling wine', 'Игристое вино', {
    subs: [['soda-water', 'Lighter, alcohol-free version', 'Легче, без алкоголя']],
  }),
  ing('red-wine', 'wine', 13, 'Red wine', 'Красное вино', {
    subs: [['white-wine', 'Lighter: makes a white version', 'Легче: получится белая версия']],
  }),
  ing(
    'aromatized-wine',
    'wine',
    17,
    'Aromatised white wine (kina)',
    'Ароматизированное белое вино (кина)',
    {
      subs: [['bianco-vermouth'], ['dry-vermouth', 'Drier and less bitter', 'Суше и менее горько']],
    },
  ),
  ing('bianco-vermouth', 'wine', 16, 'Bianco vermouth', 'Вермут бьянко', {
    subs: [['dry-vermouth', 'Drier: add a little syrup', 'Суше: добавьте немного сиропа']],
  }),
  ing('fino-sherry', 'wine', 15, 'Fino sherry', 'Херес фино', { subs: [['amontillado-sherry']] }),
  ing('amontillado-sherry', 'wine', 18, 'Amontillado sherry', 'Херес амонтильядо', {
    subs: [['fino-sherry', 'Lighter and saltier', 'Легче и солонее']],
  }),
  ing('ruby-port', 'wine', 20, 'Ruby port', 'Рубиновый портвейн', { subs: [['sweet-vermouth']] }),
  ing('white-wine', 'wine', 12, 'Dry white wine', 'Сухое белое вино', {
    subs: [['sparkling-wine', 'Lighter and fizzy', 'Легче, с пузырьками']],
  }),
  ing(
    'alcohol-free-sparkling-wine',
    'wine',
    0,
    'Alcohol-free sparkling wine',
    'Безалкогольное игристое',
    {
      subs: [
        ['soda-water', 'Less body, add a little syrup', 'Менее плотно, добавьте немного сиропа'],
      ],
    },
  ),
  ing('lager', 'beer', 5, 'Lager', 'Светлое пиво (лагер)'),
];

const bitters: IngredientInput[] = [
  ing('aromatic-bitters', 'bitters', 44, 'Aromatic bitters', 'Ароматический биттер', {
    subs: [
      ['orange-bitters', 'More citrus, less spice', 'Больше цитруса, меньше пряностей'],
      ['creole-bitters', 'Brighter, with anise', 'Ярче, с нотой аниса'],
    ],
  }),
  ing('orange-bitters', 'bitters', 40, 'Orange bitters', 'Апельсиновый биттер', {
    subs: [['aromatic-bitters']],
  }),
  ing('creole-bitters', 'bitters', 35, 'Creole bitters', 'Креольский биттер', {
    subs: [['aromatic-bitters']],
  }),
  ing('chocolate-bitters', 'bitters', 40, 'Chocolate bitters', 'Шоколадный биттер', {
    subs: [['aromatic-bitters']],
  }),
  ing('grapefruit-bitters', 'bitters', 40, 'Grapefruit bitters', 'Грейпфрутовый биттер', {
    subs: [['orange-bitters']],
  }),
];

const mixers: IngredientInput[] = [
  ing('ginger-beer', 'mixer', 0, 'Ginger beer', 'Имбирное пиво', {
    subs: [['ginger-ale', 'Milder, less spicy', 'Мягче, менее пряный']],
  }),
  ing('tonic-water', 'mixer', 0, 'Tonic water', 'Тоник', {
    loose: [
      ['soda-water', 'No bitterness: add a little syrup', 'Без горчинки: добавьте немного сиропа'],
    ],
  }),
  ing('soda-water', 'mixer', 0, 'Soda water', 'Содовая', {
    subs: [
      ['lemon-lime-soda', 'Sweeter', 'Слаще'],
      ['tonic-water', 'Bitter and sweet', 'Горьковато и сладко'],
    ],
  }),
  ing('cola', 'mixer', 0, 'Cola', 'Кола'),
  ing('grapefruit-soda', 'mixer', 0, 'Grapefruit soda', 'Грейпфрутовая газировка', {
    subs: [['grapefruit-juice', 'Add soda water on top', 'Добавьте содовую сверху']],
  }),
  ing('ginger-ale', 'mixer', 0, 'Ginger ale', 'Имбирный эль', {
    subs: [['ginger-beer', 'Spicier', 'Прянее']],
  }),
  ing('lemon-lime-soda', 'mixer', 0, 'Lemon-lime soda', 'Лимонно-лаймовая газировка', {
    subs: [['soda-water', 'Add a little syrup and lemon', 'Добавьте немного сиропа и лимона']],
  }),
  ing('coconut-water', 'mixer', 0, 'Coconut water', 'Кокосовая вода'),
  ing('black-tea', 'mixer', 0, 'Black tea', 'Чёрный чай'),
  ing('hibiscus-tea', 'mixer', 0, 'Hibiscus tea', 'Чай каркаде'),
  ing(
    'alcohol-free-bitter-aperitif',
    'mixer',
    0,
    'Alcohol-free bitter aperitif',
    'Безалкогольный горький аперитив',
    {
      subs: [['grapefruit-soda', 'Fruitier, less bitter', 'Фруктовее и менее горько']],
    },
  ),
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
  ing('orange-juice', 'juice', 0, 'Orange juice', 'Апельсиновый сок', {
    from: 'orange',
    subs: [['grapefruit-juice', 'More bitter, less sweet', 'Горче и менее сладко']],
  }),
  ing('grapefruit-juice', 'juice', 0, 'Grapefruit juice', 'Грейпфрутовый сок', {
    from: 'grapefruit',
    subs: [['orange-juice', 'Sweeter, no bitterness', 'Слаще, без горчинки']],
  }),
  ing('cranberry-juice', 'juice', 0, 'Cranberry juice', 'Клюквенный морс', {
    subs: [['blackcurrant-juice', 'Richer, less tart', 'Насыщеннее, менее кисло']],
  }),
  ing('pineapple-juice', 'juice', 0, 'Pineapple juice', 'Ананасовый сок', {
    from: 'pineapple',
    loose: [['orange-juice', 'Less tropical', 'Менее тропический вкус']],
  }),
  ing('tomato-juice', 'juice', 0, 'Tomato juice', 'Томатный сок'),
  ing('peach-puree', 'juice', 0, 'Peach purée', 'Персиковое пюре', { from: 'peach' }),
  ing('passion-fruit-puree', 'juice', 0, 'Passion fruit purée', 'Пюре маракуйи', {
    from: 'passion-fruit',
    subs: [['passion-fruit-syrup', 'Sweeter: cut the syrup', 'Слаще: уменьшите сироп']],
  }),
  ing('blackcurrant-juice', 'juice', 0, 'Blackcurrant juice', 'Сок чёрной смородины', {
    subs: [['cranberry-juice']],
  }),
  ing('cucumber-juice', 'juice', 0, 'Cucumber juice', 'Огуречный сок', { from: 'cucumber' }),
  ing('sugar-cane-juice', 'juice', 0, 'Sugar cane juice', 'Сок сахарного тростника', {
    subs: [['simple-syrup', 'Use a third as much', 'Возьмите втрое меньше']],
  }),
];

const fresh: IngredientInput[] = [
  ing('lime', 'fresh', 0, 'Lime', 'Лайм', {
    subs: [['lemon', 'Works the same way', 'Работает так же']],
  }),
  ing('lemon', 'fresh', 0, 'Lemon', 'Лимон', { subs: [['lime']] }),
  ing('orange', 'fresh', 0, 'Orange', 'Апельсин', {
    subs: [['orange-juice', 'Add a splash at the end', 'Добавьте немного в конце']],
  }),
  ing('mint', 'fresh', 0, 'Mint', 'Мята', {
    loose: [['basil', 'Peppery, less cooling', 'С перечной нотой, без холодка']],
  }),
  ing('cucumber', 'fresh', 0, 'Cucumber', 'Огурец'),
  ing('egg-white', 'fresh', 0, 'Egg white', 'Яичный белок', { from: 'egg' }),
  ing('cocktail-cherry', 'fresh', 0, 'Cocktail cherry', 'Коктейльная вишня'),
  ing('green-olive', 'fresh', 0, 'Green olive', 'Зелёная оливка'),
  ing('celery-stalk', 'fresh', 0, 'Celery stalk', 'Стебель сельдерея'),
  ing('fresh-ginger', 'fresh', 0, 'Fresh ginger', 'Свежий имбирь'),
  ing('grapefruit', 'fresh', 0, 'Grapefruit', 'Грейпфрут'),
  ing('pineapple', 'fresh', 0, 'Pineapple', 'Ананас'),
  ing('raspberry', 'fresh', 0, 'Raspberries', 'Малина', { subs: [['blackberry']] }),
  ing('blackberry', 'fresh', 0, 'Blackberries', 'Ежевика', { subs: [['raspberry']] }),
  ing('strawberry', 'fresh', 0, 'Strawberries', 'Клубника', { subs: [['raspberry']] }),
  ing('passion-fruit', 'fresh', 0, 'Passion fruit', 'Маракуйя'),
  ing('peach', 'fresh', 0, 'Peach', 'Персик'),
  ing('watermelon', 'fresh', 0, 'Watermelon', 'Арбуз'),
  ing('green-grape', 'fresh', 0, 'Green grapes', 'Зелёный виноград'),
  ing('basil', 'fresh', 0, 'Basil', 'Базилик', {
    subs: [['mint', 'Cooler, less peppery', 'Свежее, без перечной ноты']],
  }),
  ing('rosemary', 'fresh', 0, 'Rosemary', 'Розмарин'),
  ing('egg', 'fresh', 0, 'Egg', 'Яйцо'),
  ing('egg-yolk', 'fresh', 0, 'Egg yolk', 'Яичный желток', { from: 'egg' }),
];

const syrups: IngredientInput[] = [
  ing('simple-syrup', 'syrup', 0, 'Simple syrup', 'Сахарный сироп', {
    from: 'sugar',
    subs: [['honey-syrup'], ['agave-syrup']],
  }),
  ing('rich-syrup', 'syrup', 0, 'Rich sugar syrup (2:1)', 'Густой сахарный сироп (2:1)', {
    from: 'sugar',
    subs: [['simple-syrup', 'Use half as much again', 'Возьмите в полтора раза больше']],
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
  ing('orgeat', 'syrup', 0, 'Orgeat (almond syrup)', 'Оршад (миндальный сироп)', {
    subs: [['simple-syrup', 'Loses the almond note', 'Без миндальной ноты']],
  }),
  ing('maple-syrup', 'syrup', 0, 'Maple syrup', 'Кленовый сироп', {
    subs: [['demerara-syrup'], ['honey-syrup']],
  }),
  ing('lime-cordial', 'syrup', 0, 'Lime cordial', 'Лаймовый кордиал', {
    subs: [['simple-syrup', 'Add a little more lime juice', 'Добавьте ещё немного сока лайма']],
  }),
  ing('passion-fruit-syrup', 'syrup', 0, 'Passion fruit syrup', 'Сироп маракуйи', {
    subs: [
      ['passion-fruit-puree', 'Tarter: add a little syrup', 'Кислее: добавьте немного сиропа'],
    ],
  }),
  ing('cinnamon-syrup', 'syrup', 0, 'Cinnamon syrup', 'Коричный сироп', {
    from: 'cinnamon-stick',
    subs: [['simple-syrup']],
  }),
  ing('raspberry-syrup', 'syrup', 0, 'Raspberry syrup', 'Малиновый сироп', {
    from: 'raspberry',
    subs: [['grenadine']],
  }),
  ing('elderflower-syrup', 'syrup', 0, 'Elderflower syrup', 'Сироп бузины', {
    subs: [['simple-syrup']],
  }),
  ing('rosemary-syrup', 'syrup', 0, 'Rosemary syrup', 'Розмариновый сироп', {
    from: 'rosemary',
    subs: [['simple-syrup']],
  }),
];

const dairy: IngredientInput[] = [
  ing('cream', 'dairy', 0, 'Cream', 'Сливки', {
    subs: [['milk', 'Thinner body', 'Менее плотная текстура']],
  }),
  ing('milk', 'dairy', 0, 'Milk', 'Молоко', {
    subs: [['cream', 'Richer: thin with water', 'Гуще: разбавьте водой']],
  }),
  ing('butter', 'dairy', 0, 'Butter', 'Сливочное масло'),
  ing('condensed-milk', 'dairy', 0, 'Sweetened condensed milk', 'Сгущённое молоко', {
    subs: [['cream', 'Add sugar syrup to taste', 'Добавьте сахарный сироп по вкусу']],
  }),
];

const pantry: IngredientInput[] = [
  ing('sugar', 'pantry', 0, 'Sugar', 'Сахар', {
    subs: [['simple-syrup', 'About 8 ml per spoon or cube', 'Примерно 8 мл на ложку или кубик']],
  }),
  ing('honey', 'pantry', 0, 'Honey', 'Мёд', { subs: [['honey-syrup'], ['simple-syrup']] }),
  ing('salt', 'pantry', 0, 'Salt', 'Соль'),
  ing('espresso', 'pantry', 0, 'Espresso', 'Эспрессо', {
    subs: [['brewed-coffee', 'Brew it extra strong', 'Заварите очень крепким']],
  }),
  ing('brewed-coffee', 'pantry', 0, 'Hot brewed coffee', 'Горячий чёрный кофе', {
    subs: [['espresso', 'Top up with hot water', 'Долейте горячей водой']],
  }),
  ing('celery-salt', 'pantry', 0, 'Celery salt', 'Сельдерейная соль', { subs: [['salt']] }),
  ing('worcestershire-style-sauce', 'pantry', 0, 'Worcestershire-style sauce', 'Вустерский соус'),
  ing('hot-sauce', 'pantry', 0, 'Hot pepper sauce', 'Острый перечный соус'),
  ing('black-pepper', 'pantry', 0, 'Black pepper', 'Чёрный перец'),
  ing('nutmeg', 'pantry', 0, 'Nutmeg', 'Мускатный орех'),
  ing('cinnamon-stick', 'pantry', 0, 'Cinnamon stick', 'Палочка корицы', {
    subs: [['cinnamon-syrup', 'Sweeter', 'Слаще']],
  }),
  ing('cloves', 'pantry', 0, 'Cloves', 'Гвоздика'),
  ing('star-anise', 'pantry', 0, 'Star anise', 'Звёздчатый анис'),
  ing('coconut-cream', 'pantry', 0, 'Coconut cream', 'Кокосовые сливки', {
    subs: [['cream-of-coconut', 'Sweeter: use a little less', 'Слаще: возьмите чуть меньше']],
  }),
  ing('apple-juice', 'juice', 0, 'Apple juice', 'Яблочный сок'),
  ing('cream-of-coconut', 'pantry', 0, 'Cream of coconut (sweetened)', 'Кокосовый крем (сладкий)', {
    subs: [['coconut-cream', 'Add sugar syrup to taste', 'Добавьте сахарный сироп по вкусу']],
  }),
  ing('cocoa-powder', 'pantry', 0, 'Cocoa powder', 'Какао-порошок', {
    subs: [['dark-chocolate', 'Richer: cut the sugar', 'Насыщеннее: уменьшите сахар']],
  }),
  ing('dark-chocolate', 'pantry', 0, 'Dark chocolate', 'Тёмный шоколад', {
    subs: [['cocoa-powder']],
  }),
  ing('chili-powder', 'pantry', 0, 'Chili powder', 'Молотый перец чили'),
  ing('cardamom-pods', 'pantry', 0, 'Cardamom pods', 'Кардамон'),
  ing('almonds', 'pantry', 0, 'Blanched almonds', 'Очищенный миндаль'),
  ing('raisins', 'pantry', 0, 'Raisins', 'Изюм'),
  ing('apple-cider-vinegar', 'pantry', 0, 'Apple cider vinegar', 'Яблочный уксус'),
  ing('olive-brine', 'pantry', 0, 'Olive brine', 'Оливковый рассол', { from: 'green-olive' }),
  ing('cocktail-onion', 'pantry', 0, 'Cocktail onions', 'Коктейльный лук'),
  ing('orange-flower-water', 'pantry', 0, 'Orange flower water', 'Вода флёрдоранжа'),
  // Alcoholic, but used by the drop: the ABV is real so alcohol-free drinks never list it.
  ing('vanilla-extract', 'pantry', 35, 'Vanilla extract', 'Ванильный экстракт'),
  ing('cold-brew-concentrate', 'pantry', 0, 'Cold brew concentrate', 'Концентрат колд брю', {
    subs: [['espresso']],
  }),
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
