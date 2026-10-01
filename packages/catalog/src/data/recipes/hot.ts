import { bsp, dash, garnish, ml, pc, recipe, top } from '../helpers.ts';

export const hot = [
  recipe({
    id: 'irish-coffee',
    name: ['Irish Coffee', 'Айриш кофе'],
    desc: [
      'Hot coffee, Irish whiskey and a little sugar under a cool cap of cream: dessert and nightcap in one glass.',
      'Горячий кофе, ирландский виски и щепотка сахара под прохладной сливочной шапкой: десерт и ночной бокал в одном.',
    ],
    glass: 'irish-coffee',
    method: 'heat',
    ingredients: [
      ml('irish-whiskey', 40),
      ml('brewed-coffee', 100),
      bsp('sugar', 2),
      ml('cream', 30),
    ],
    steps: [
      [
        'Warm a heatproof glass with hot water, then empty it.',
        'Прогрейте жаропрочный бокал горячей водой и вылейте её.',
      ],
      [
        'Add the sugar, hot coffee and whiskey, and stir until dissolved.',
        'Добавьте сахар, горячий кофе и виски, размешайте до растворения.',
      ],
      [
        'Lightly whip the cream so it is thick but still pourable.',
        'Слегка взбейте сливки, чтобы они загустели, но оставались текучими.',
      ],
      [
        'Pour the cream over the back of a spoon so it floats on top.',
        'Вылейте сливки по спинке ложки, чтобы они легли сверху.',
      ],
    ],
    occasions: ['chill', 'date'],
    flavors: ['creamy', 'sweet', 'boozy'],
    dayparts: ['late', 'evening'],
    weather: ['cold', 'rainy'],
    difficulty: 2,
    minutes: 6,
    iba: true,
  }),
  recipe({
    id: 'hot-toddy',
    name: ['Hot Toddy', 'Горячий тодди'],
    desc: [
      'Whisky, honey, lemon and hot water with warm spices: a soothing mug for cold, damp days.',
      'Виски, мёд, лимон и горячая вода с тёплыми специями: успокаивающая кружка для холодных сырых дней.',
    ],
    glass: 'irish-coffee',
    method: 'heat',
    ingredients: [
      ml('scotch-whisky', 45),
      bsp('honey', 2),
      ml('lemon-juice', 15),
      ml('water', 120),
      garnish('cinnamon-stick'),
      garnish('cloves', { unit: 'piece', value: 3, noun: { en: 'buds', ru: 'бутона' } }),
    ],
    steps: [
      [
        'Heat the water until steaming, but not boiling.',
        'Нагрейте воду до пара, но не до кипения.',
      ],
      [
        'Put the honey and lemon juice in a heatproof mug.',
        'Положите мёд и налейте лимонный сок в жаропрочную кружку.',
      ],
      [
        'Pour in the hot water and stir until the honey dissolves.',
        'Влейте горячую воду и размешайте до растворения мёда.',
      ],
      ['Add the whisky and stir once more.', 'Добавьте виски и ещё раз размешайте.'],
      ['Garnish with a cinnamon stick and cloves.', 'Украсьте палочкой корицы и гвоздикой.'],
    ],
    occasions: ['chill'],
    flavors: ['sweet', 'sour', 'spicy'],
    dayparts: ['evening', 'late'],
    weather: ['cold', 'rainy'],
    difficulty: 1,
    minutes: 5,
    twin: 'hot-honey-lemon',
  }),
  recipe({
    id: 'mulled-wine',
    name: ['Mulled Wine', 'Глинтвейн'],
    desc: [
      'Red wine gently simmered with orange, cinnamon and cloves: the smell of winter gatherings.',
      'Красное вино, томлённое с апельсином, корицей и гвоздикой: запах зимних посиделок.',
    ],
    glass: 'irish-coffee',
    method: 'heat',
    ingredients: [
      ml('red-wine', 150),
      pc('orange', 2, { en: 'slices', ru: 'кружка' }),
      bsp('honey', 2),
      pc('cinnamon-stick', 1),
      pc('cloves', 3, { en: 'buds', ru: 'бутона' }),
      pc('star-anise', 1, undefined, { optional: true }),
    ],
    steps: [
      [
        'Add the wine, orange slices, honey and spices to a small pot.',
        'Положите в небольшую кастрюлю вино, кружки апельсина, мёд и специи.',
      ],
      [
        'Warm over low heat for 10 minutes, without letting it boil.',
        'Нагревайте на слабом огне 10 минут, не доводя до кипения.',
      ],
      ['Taste and add more honey if needed.', 'Попробуйте и при необходимости добавьте ещё мёда.'],
      [
        'Strain into a heatproof mug and serve hot.',
        'Процедите в жаропрочную кружку и подавайте горячим.',
      ],
    ],
    occasions: ['party', 'chill'],
    flavors: ['spicy', 'sweet', 'fruity'],
    dayparts: ['evening', 'late'],
    weather: ['cold', 'rainy'],
    difficulty: 1,
    minutes: 15,
  }),
  // Source: https://www.diffordsguide.com/cocktails/recipe/981/hot-buttered-rum-cocktail
  recipe({
    id: 'hot-buttered-rum',
    name: ['Hot Buttered Rum', 'Горячий ром с маслом'],
    desc: [
      'Dark rum, honey, butter and nutmeg under boiling water: rich, silky and warming from the first sip.',
      'Тёмный ром, мёд, сливочное масло и мускатный орех в кипятке: насыщенный, шелковистый и согревающий.',
    ],
    glass: 'irish-coffee',
    method: 'heat',
    ingredients: [
      bsp('honey', 2),
      pc('butter', 1, { en: 'knob', ru: 'кусочек' }),
      ml('dark-rum', 60),
      pc('nutmeg', 2, { en: 'pinch', ru: 'щепотка' }),
      top('water', 90),
      garnish('cinnamon-stick'),
      garnish('lemon', {
        unit: 'piece',
        value: 1,
        noun: { en: 'slice studded with cloves', ru: 'долька с гвоздикой' },
      }),
    ],
    steps: [
      [
        'Warm a heatproof glass with hot water, then empty it.',
        'Прогрейте жаропрочный бокал горячей водой и вылейте её.',
      ],
      [
        'Add the honey, butter, rum and freshly grated nutmeg.',
        'Добавьте мёд, сливочное масло, ром и свежетёртый мускатный орех.',
      ],
      [
        'Top with boiling water and stir until the honey and butter dissolve.',
        'Долейте кипяток и размешайте до растворения мёда и масла.',
      ],
      [
        'Garnish with a cinnamon stick and a clove-studded lemon slice.',
        'Украсьте палочкой корицы и долькой лимона с гвоздикой.',
      ],
    ],
    occasions: ['chill', 'date'],
    flavors: ['sweet', 'spicy', 'boozy'],
    dayparts: ['evening', 'late'],
    weather: ['cold', 'rainy'],
    difficulty: 1,
    minutes: 4,
  }),
  // Source: https://www.diffordsguide.com/cocktails/recipe/982/hot-grog
  recipe({
    id: 'hot-grog',
    name: ['Hot Grog', 'Горячий грог'],
    desc: [
      'Dark rum, honey and a splash of lime in hot water: the old sailor warmer, simple and quietly tart.',
      'Тёмный ром, мёд и немного лайма в горячей воде: старинный матросский согреватель, простой и с лёгкой кислинкой.',
    ],
    glass: 'irish-coffee',
    method: 'heat',
    ingredients: [
      bsp('honey', 3),
      ml('dark-rum', 30),
      ml('lime-juice', 7.5),
      ml('water', 75),
      garnish('lemon', {
        unit: 'piece',
        value: 1,
        noun: { en: 'zest twist', ru: 'цедра' },
      }),
    ],
    steps: [
      [
        'Warm a heatproof glass with hot water, then empty it.',
        'Прогрейте жаропрочный бокал горячей водой и вылейте её.',
      ],
      ['Add the honey, rum and lime juice.', 'Добавьте мёд, ром и сок лайма.'],
      [
        'Pour in the boiling water and stir until the honey dissolves.',
        'Влейте кипяток и размешайте до растворения мёда.',
      ],
      ['Garnish with a lemon zest twist.', 'Украсьте твистом из лимонной цедры.'],
    ],
    occasions: ['chill'],
    flavors: ['sweet', 'boozy', 'fresh'],
    dayparts: ['evening', 'late'],
    weather: ['cold', 'rainy'],
    difficulty: 1,
    minutes: 3,
  }),
  // Source: https://www.cocktailchemistrylab.com/home/hot-chocolate
  recipe({
    id: 'spiked-hot-chocolate',
    name: ['Spiked Hot Chocolate', 'Горячий шоколад с ромом'],
    desc: [
      'Real cocoa heated with milk and a pinch of salt, finished with dark rum: dessert in a mug.',
      'Настоящее какао на молоке с щепоткой соли и тёмным ромом: десерт в кружке.',
    ],
    glass: 'irish-coffee',
    method: 'heat',
    ingredients: [
      bsp('cocoa-powder', 6),
      bsp('sugar', 4.5),
      ml('milk', 235),
      pc('salt', 1, { en: 'pinch', ru: 'щепотка' }),
      ml('dark-rum', 45),
    ],
    steps: [
      [
        'Whisk the cocoa, sugar, salt and milk in a small saucepan.',
        'Взбейте венчиком какао, сахар, соль и молоко в небольшой кастрюле.',
      ],
      [
        'Heat while whisking until steaming; do not boil.',
        'Нагревайте, помешивая венчиком, до пара; не доводите до кипения.',
      ],
      [
        'Pour into a warmed mug and stir in the rum.',
        'Перелейте в прогретую кружку и вмешайте ром.',
      ],
    ],
    occasions: ['chill', 'date'],
    flavors: ['sweet', 'creamy', 'boozy'],
    dayparts: ['evening', 'late'],
    weather: ['cold', 'rainy'],
    difficulty: 1,
    minutes: 8,
  }),
  // Source: https://www.primermagazine.com/2013/field-manual/its-fridayhave-a-drink-mulled-cider
  recipe({
    id: 'mulled-cider',
    name: ['Mulled Cider', 'Яблочный глинтвейн'],
    desc: [
      'Apple juice simmered with whole spices, then spiked with aged rum and apple brandy: orchard fruit in winter dress.',
      'Яблочный сок, настоянный на пряностях, с выдержанным ромом и яблочным бренди: яблоневый сад в зимнем наряде.',
    ],
    glass: 'irish-coffee',
    method: 'heat',
    ingredients: [
      ml('dark-rum', 30),
      ml('apple-brandy', 30),
      ml('apple-juice', 120),
      dash('aromatic-bitters', 1),
      dash('orange-bitters', 1),
      pc('cinnamon-stick', 2),
      pc('cloves', 3),
      pc('star-anise', 1),
      pc('nutmeg', 1, { en: 'pinch grated', ru: 'щепотка тёртого' }),
    ],
    steps: [
      [
        'Tie the cloves, star anise and nutmeg in a small cheesecloth bag.',
        'Завяжите гвоздику, бадьян и мускатный орех в небольшой марлевый мешочек.',
      ],
      [
        'Simmer the apple juice with the bag, a cinnamon stick and both bitters on the lowest heat for 15 minutes.',
        'Томите яблочный сок с мешочком, палочкой корицы и обоими биттерами на самом слабом огне 15 минут.',
      ],
      [
        'Remove the bag, then stir in the rum and apple brandy.',
        'Выньте мешочек, затем добавьте ром и яблочный бренди и размешайте.',
      ],
      [
        'Pour into a warmed mug and garnish with a cinnamon stick.',
        'Перелейте в прогретую кружку и украсьте палочкой корицы.',
      ],
    ],
    occasions: ['chill', 'party'],
    flavors: ['spicy', 'fruity', 'boozy'],
    dayparts: ['evening'],
    weather: ['cold', 'rainy'],
    difficulty: 2,
    minutes: 20,
  }),
  // Source: https://www.diffordsguide.com/cocktails/recipe/1971/tom-and-jerry-serves-6
  // Written for two drinks (1 egg), as in the spec; the first step says so.
  recipe({
    id: 'tom-and-jerry',
    name: ['Tom and Jerry', 'Том и Джерри'],
    desc: [
      'A spiced egg batter, cognac and dark rum under boiling water: a frothy, creamy Christmas classic.',
      'Пряный яичный крем, коньяк и тёмный ром под кипятком: пенный сливочный рождественский классик.',
    ],
    glass: 'irish-coffee',
    method: 'heat',
    ingredients: [
      pc('egg', 1),
      bsp('sugar', 3),
      pc('cinnamon-stick', 1, { en: 'pinch ground', ru: 'щепотка молотой' }, { optional: true }),
      pc('cloves', 1, { en: 'pinch ground', ru: 'щепотка молотой' }, { optional: true }),
      ml('cognac', 90),
      ml('dark-rum', 30),
      top('water', 200),
      garnish('nutmeg', {
        unit: 'piece',
        value: 1,
        noun: { en: 'pinch grated', ru: 'щепотка тёртого' },
      }),
    ],
    steps: [
      [
        'Makes 2 drinks. The batter is not cooked, so use pasteurised eggs. Warm two mugs with hot water. Separate the egg; beat the yolk with the sugar and spices until pale and thin.',
        'Рецепт на 2 порции. Возьмите пастеризованные яйца: тесто не проваривается. Прогрейте две кружки горячей водой. Отделите желток от белка; взбейте желток с сахаром и специями до светлой жидкой массы.',
      ],
      [
        'Whisk the white to a stiff froth and fold it into the yolk to make the batter.',
        'Взбейте белок до плотной пены и аккуратно вмешайте в желток: это основа.',
      ],
      [
        'Divide the cognac and rum between the mugs and add about two tablespoons of batter to each.',
        'Разделите коньяк и ром между кружками и добавьте в каждую около двух столовых ложек основы.',
      ],
      [
        'Top with boiling water, pouring slowly while stirring, and grate nutmeg over the foam.',
        'Долейте кипяток, наливая медленно и помешивая, и посыпьте пену тёртым мускатным орехом.',
      ],
    ],
    occasions: ['party', 'chill'],
    flavors: ['sweet', 'creamy', 'spicy'],
    dayparts: ['evening'],
    weather: ['cold', 'rainy'],
    difficulty: 3,
    minutes: 12,
  }),
  // Source: https://www.dolcevia.com/en/recipes/how-to-make-the-italian-bombardino-a-favourite-drink-with-skiers-in-the-dolomites
  recipe({
    id: 'bombardino',
    name: ['Bombardino', 'Бомбардино'],
    desc: [
      'Hot egg liqueur spiked with brandy and crowned with cream: the thick, sweet ski-slope warmer of the Dolomites.',
      'Горячий яичный ликёр с бренди под сливочной шапкой: густой сладкий согреватель горнолыжных склонов Доломитов.',
    ],
    glass: 'irish-coffee',
    method: 'heat',
    ingredients: [
      ml('egg-liqueur', 70),
      ml('brandy', 25),
      garnish('cream', { unit: 'ml', value: 30 }),
      garnish('cinnamon-stick', {
        unit: 'piece',
        value: 1,
        noun: { en: 'pinch ground cinnamon', ru: 'щепотка корицы' },
      }),
    ],
    steps: [
      [
        'Warm the egg liqueur gently in a small pan over low heat, away from open flame; it should be hot but never boil.',
        'Аккуратно прогрейте яичный ликёр в небольшой кастрюле на слабом огне, вдали от открытого пламени: он должен быть горячим, но не кипеть.',
      ],
      [
        'Stir in the brandy and pour into a warmed heatproof glass.',
        'Добавьте бренди, размешайте и перелейте в прогретый жаропрочный бокал.',
      ],
      [
        'Top with whipped cream and dust with cocoa or cinnamon.',
        'Украсьте взбитыми сливками и посыпьте какао или корицей.',
      ],
    ],
    occasions: ['chill', 'party'],
    flavors: ['sweet', 'creamy', 'boozy'],
    dayparts: ['evening', 'late'],
    weather: ['cold'],
    difficulty: 1,
    minutes: 5,
  }),
  // Source: https://www.kaffeeroesterei-kirmse.de/en/carajillo-rezept
  recipe({
    id: 'hot-carajillo',
    name: ['Hot Carajillo', 'Горячий карахильо'],
    desc: [
      'Espresso with warmed brandy, a little sugar and lemon peel: the Spanish after-lunch coffee with a kick.',
      'Эспрессо с подогретым бренди, щепоткой сахара и лимонной цедрой: испанский послеобеденный кофе с характером.',
    ],
    glass: 'irish-coffee',
    method: 'heat',
    ingredients: [
      ml('espresso', 40),
      ml('brandy', 25),
      bsp('sugar', 1),
      pc('lemon', 1, { en: 'strip of peel', ru: 'полоска цедры' }),
    ],
    steps: [
      ['Rinse a heatproof glass with hot water.', 'Ополосните жаропрочный бокал горячей водой.'],
      [
        'Warm the brandy with the sugar and lemon peel in a small pan over low heat, away from open flame, for about a minute until the sugar dissolves; do not boil or ignite.',
        'Прогрейте бренди с сахаром и лимонной цедрой в небольшой кастрюле на слабом огне, вдали от открытого пламени, около минуты до растворения сахара; не кипятите и не поджигайте.',
      ],
      [
        'Pour into the glass and add freshly pulled hot espresso.',
        'Перелейте в бокал и добавьте свежесваренный горячий эспрессо.',
      ],
      ['Stir briefly and serve hot.', 'Коротко размешайте и подавайте горячим.'],
    ],
    occasions: ['after-work', 'chill'],
    flavors: ['boozy', 'sweet', 'bitter'],
    dayparts: ['brunch', 'late'],
    weather: ['cold', 'rainy'],
    difficulty: 1,
    minutes: 4,
  }),
  // Source: https://marcussamuelsson.com/recipe/delicious-swedish-holiday-drink-glogg
  recipe({
    id: 'glogg',
    name: ['Glögg', 'Глёгг'],
    desc: [
      'Swedish mulled red wine with port, vodka, cardamom, almonds and raisins: a spicy, sweet midwinter mug.',
      'Шведский глинтвейн из красного вина с портвейном, водкой, кардамоном, миндалём и изюмом: пряная сладкая кружка зимы.',
    ],
    glass: 'wine',
    method: 'heat',
    ingredients: [
      ml('red-wine', 90),
      ml('ruby-port', 30),
      ml('vodka', 15),
      bsp('sugar', 4),
      pc('cinnamon-stick', 1),
      pc('cloves', 2),
      pc('cardamom-pods', 1),
      pc('orange', 1, { en: 'strip of zest', ru: 'полоска цедры' }),
      pc('almonds', 8, { en: 'blanched', ru: 'очищенный' }),
      bsp('raisins', 2),
    ],
    steps: [
      [
        'Warm the wine, port, sugar, cinnamon, cloves, cardamom and orange zest in a small pan until bubbles just form at the edge; do not boil.',
        'Прогрейте вино, портвейн, сахар, корицу, гвоздику, кардамон и апельсиновую цедру в небольшой кастрюле, пока по краю не появятся пузырьки; не кипятите.',
      ],
      [
        'Let it steep off the heat for 10 minutes, then strain back into the pan.',
        'Настаивайте 10 минут вне огня, затем процедите обратно в кастрюлю.',
      ],
      [
        'Stir in the vodka and reheat gently.',
        'Добавьте водку, размешайте и аккуратно подогрейте.',
      ],
      [
        'Pour into a heatproof glass over the almonds and raisins.',
        'Перелейте в термостойкий бокал поверх миндаля и изюма.',
      ],
    ],
    occasions: ['party', 'chill'],
    flavors: ['spicy', 'sweet', 'fruity'],
    dayparts: ['evening'],
    weather: ['cold', 'rainy'],
    difficulty: 2,
    minutes: 20,
  }),
  // Source: https://www.thethreedrinkers.com/magazine-content/tag/Toffee+Apple+Hot+Toddy+Recipe
  recipe({
    id: 'hot-apple-toddy',
    name: ['Hot Apple Toddy', 'Горячий яблочный тодди'],
    desc: [
      'Warm apple juice, honey and whisky: a gentle, fruity toddy that is easy to make in minutes.',
      'Тёплый яблочный сок, мёд и виски: мягкий фруктовый тодди, который готовится за несколько минут.',
    ],
    glass: 'irish-coffee',
    method: 'heat',
    ingredients: [
      bsp('honey', 1),
      ml('apple-juice', 100),
      ml('whisky', 35),
      pc('cinnamon-stick', 1, undefined, { optional: true }),
    ],
    steps: [
      [
        'Warm the apple juice in a saucepan until hot but not boiling.',
        'Нагрейте яблочный сок в кастрюле до горячего состояния, но не до кипения.',
      ],
      [
        'Put the honey in the bottom of a warmed mug and pour in the apple juice.',
        'Положите мёд на дно прогретой кружки и влейте яблочный сок.',
      ],
      [
        'Add the whisky and stir until the honey dissolves.',
        'Добавьте виски и размешайте до растворения мёда.',
      ],
      ['Add a cinnamon stick if you like.', 'При желании добавьте палочку корицы.'],
    ],
    occasions: ['chill'],
    flavors: ['sweet', 'fruity', 'boozy'],
    dayparts: ['evening'],
    weather: ['cold', 'rainy'],
    difficulty: 1,
    minutes: 5,
  }),
  // Source: https://www.cruzanrum.com/rum-cocktails/flavored-rums/spiced-hot-apple-cider
  recipe({
    id: 'hot-spiced-rum-punch',
    name: ['Hot Spiced Rum Punch', 'Горячий пряный ромовый пунш'],
    desc: [
      'Spiced rum stirred into hot apple juice with honey and orange: sweet, fruity and easy to batch.',
      'Пряный ром в горячем яблочном соке с мёдом и апельсином: сладкий, фруктовый, легко готовить на компанию.',
    ],
    glass: 'irish-coffee',
    method: 'heat',
    ingredients: [
      ml('spiced-rum', 45),
      ml('honey', 15),
      ml('orange-juice', 15),
      ml('apple-juice', 120),
      garnish('cinnamon-stick'),
    ],
    steps: [
      [
        'Heat the apple juice, orange juice and honey in a saucepan over medium-low heat, stirring until the honey dissolves.',
        'Нагрейте яблочный сок, апельсиновый сок и мёд в кастрюле на слабом среднем огне, помешивая до растворения мёда.',
      ],
      ['Pour into a warmed heatproof mug.', 'Перелейте в прогретую жаропрочную кружку.'],
      ['Add the rum and stir.', 'Добавьте ром и размешайте.'],
      ['Garnish with a cinnamon stick.', 'Украсьте палочкой корицы.'],
    ],
    occasions: ['party', 'chill'],
    flavors: ['sweet', 'fruity', 'spicy'],
    dayparts: ['evening'],
    weather: ['cold', 'rainy'],
    difficulty: 1,
    minutes: 6,
  }),
  // Source: https://www.diffordsguide.com/cocktails/recipe/3380/hot-gin-toddy
  // The spec lists water twice (30 ml, then a top of 90 ml); one line per id, so the 30 ml line is kept
  // and the step tops with boiling water.
  recipe({
    id: 'hot-gin-toddy',
    name: ['Hot Gin Toddy', 'Горячий джин-тодди'],
    desc: [
      'Gin, a little syrup and boiling water with an orange twist: a clean, herbal toddy for cold evenings.',
      'Джин, немного сиропа и кипяток с апельсиновой цедрой: чистый травянистый тодди для холодных вечеров.',
    ],
    glass: 'irish-coffee',
    method: 'heat',
    ingredients: [
      ml('gin', 60),
      ml('simple-syrup', 7.5),
      // 30 ml cold water, then about 90 ml boiling: one line, so ABV counts the whole dilution.
      top('water', 120),
      garnish('orange', {
        unit: 'piece',
        value: 1,
        noun: { en: "zest horse's neck", ru: 'длинная цедра' },
      }),
    ],
    steps: [
      [
        'Warm a heatproof glass and leave a bar spoon in it.',
        'Прогрейте жаропрочный бокал и оставьте в нём барную ложку.',
      ],
      [
        'Add the gin, syrup and 30 ml of cold water.',
        'Добавьте джин, сироп и 30 мл холодной воды.',
      ],
      [
        'Top with about 90 ml of boiling water and stir.',
        'Долейте около 90 мл кипятка и размешайте.',
      ],
      ['Garnish with a long orange zest twist.', 'Украсьте длинной спиралью апельсиновой цедры.'],
    ],
    occasions: ['chill'],
    flavors: ['boozy', 'sweet', 'herbal'],
    dayparts: ['evening', 'late'],
    weather: ['cold', 'rainy'],
    difficulty: 1,
    minutes: 3,
  }),
  // Source: https://www.diffordsguide.com/cocktails/recipe/2181/hot-toddy-brandy-and-lemon
  recipe({
    id: 'hot-brandy-toddy',
    name: ['Hot Brandy Toddy', 'Горячий бренди-тодди'],
    desc: [
      'Cognac, lemon and demerara syrup under boiling water: smooth, tart and rounded by warm caramel.',
      'Коньяк, лимон и демерарный сироп под кипятком: мягкий, с кислинкой и тёплой карамельной нотой.',
    ],
    glass: 'irish-coffee',
    method: 'heat',
    ingredients: [
      ml('cognac', 45),
      ml('lemon-juice', 10),
      ml('demerara-syrup', 10),
      top('water', 75),
      garnish('lemon', {
        unit: 'piece',
        value: 1,
        noun: { en: 'zest twist', ru: 'цедра' },
      }),
    ],
    steps: [
      [
        'Warm a heatproof glass with hot water, then empty it.',
        'Прогрейте жаропрочный бокал горячей водой и вылейте её.',
      ],
      [
        'Add the cognac, lemon juice and syrup and stir.',
        'Добавьте коньяк, лимонный сок и сироп и размешайте.',
      ],
      [
        'Top with boiling water while the spoon is still in the glass and stir briefly.',
        'Долейте кипяток, пока ложка в бокале, и коротко размешайте.',
      ],
      [
        'Express a zest twist over the drink and use as garnish.',
        'Выдавите эфирные масла цедры над напитком и используйте её как украшение.',
      ],
    ],
    occasions: ['chill', 'date'],
    flavors: ['sour', 'sweet', 'boozy'],
    dayparts: ['evening'],
    weather: ['cold', 'rainy'],
    difficulty: 1,
    minutes: 3,
  }),
  // Source: https://en.wikipedia.org/wiki/R%C3%BCdesheimer_Kaffee
  recipe({
    id: 'rudesheimer-coffee',
    name: ['Rüdesheimer Coffee', 'Рюдесхаймер кофе'],
    desc: [
      'Hot coffee with warmed sugared brandy, whipped cream and dark chocolate: a German riverside classic.',
      'Горячий кофе с подогретым бренди и сахаром, взбитыми сливками и тёмным шоколадом: немецкая классика берегов Рейна.',
    ],
    glass: 'irish-coffee',
    method: 'heat',
    ingredients: [
      ml('brewed-coffee', 125),
      ml('brandy', 40),
      pc('sugar', 3, { en: 'cube', ru: 'кубик' }),
      garnish('cream', { unit: 'ml', value: 40 }),
      garnish('dark-chocolate', {
        unit: 'piece',
        value: 1,
        noun: { en: 'pinch shavings', ru: 'щепотка стружки' },
      }),
    ],
    steps: [
      [
        'Warm the brandy with the sugar cubes in a small pan over low heat, away from open flame, until hot but not boiling; stir until the sugar dissolves.',
        'Прогрейте бренди с кубиками сахара в небольшой кастрюле на слабом огне, вдали от открытого пламени, до горячего, но не кипящего состояния; размешайте до растворения сахара.',
      ],
      [
        'Pour into a warmed glass and add the hot coffee.',
        'Перелейте в прогретый бокал и добавьте горячий кофе.',
      ],
      [
        'Top with thickly whipped sweetened cream.',
        'Выложите сверху плотно взбитые подслащённые сливки.',
      ],
      ['Sprinkle with dark chocolate shavings.', 'Посыпьте стружкой тёмного шоколада.'],
    ],
    occasions: ['after-work', 'date'],
    flavors: ['creamy', 'sweet', 'boozy'],
    dayparts: ['brunch', 'late'],
    weather: ['cold', 'rainy'],
    difficulty: 2,
    minutes: 6,
  }),
  // Source: https://www.diffordsguide.com/cocktails/recipe/3451/mulled-apple-black
  recipe({
    id: 'mulled-apple-black',
    name: ['Mulled Apple Black', 'Глинтвейн яблоко-смородина'],
    desc: [
      'Apple brandy, blackcurrant juice and a little red wine heated gently: fruity, jammy and quick to make.',
      'Яблочный бренди, смородиновый сок и немного красного вина, мягко подогретые: фруктовый, джемовый и быстрый в приготовлении.',
    ],
    glass: 'irish-coffee',
    method: 'heat',
    ingredients: [ml('apple-brandy', 45), ml('blackcurrant-juice', 105), ml('red-wine', 30)],
    steps: [
      [
        'Combine the apple brandy, blackcurrant juice and red wine in a small pan.',
        'Соедините яблочный бренди, смородиновый сок и красное вино в небольшой кастрюле.',
      ],
      [
        'Heat gently over low heat, away from open flame, until hot; do not boil.',
        'Аккуратно нагрейте на слабом огне, вдали от открытого пламени, до горячего; не кипятите.',
      ],
      ['Pour into a warmed glass.', 'Перелейте в прогретый бокал.'],
    ],
    occasions: ['chill', 'date'],
    flavors: ['fruity', 'boozy', 'sweet'],
    dayparts: ['evening'],
    weather: ['cold', 'rainy'],
    difficulty: 1,
    minutes: 5,
  }),
];
