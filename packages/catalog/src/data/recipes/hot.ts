import { bsp, garnish, ml, pc, recipe } from '../helpers.ts';

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
];
