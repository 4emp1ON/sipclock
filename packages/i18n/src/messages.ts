import type { Daypart, Flavor, Glass, Method, Occasion } from '@sipclock/domain';

export type Locale = 'en' | 'ru';
export const locales: readonly Locale[] = ['en', 'ru'];

type Dict<K extends string> = Record<Locale, Record<K, string>>;

export const occasionLabel: Dict<Occasion> = {
  en: {
    'after-work': 'After work',
    date: 'Date',
    party: 'Party',
    chill: 'Chill',
    brunch: 'Brunch',
  },
  ru: {
    'after-work': 'После работы',
    date: 'Свидание',
    party: 'Вечеринка',
    chill: 'Отдых',
    brunch: 'Бранч',
  },
};

export const flavorLabel: Dict<Flavor> = {
  en: {
    sour: 'sour',
    sweet: 'sweet',
    bitter: 'bitter',
    fresh: 'fresh',
    fruity: 'fruity',
    herbal: 'herbal',
    spicy: 'spicy',
    creamy: 'creamy',
    smoky: 'smoky',
    boozy: 'spirit-forward',
  },
  ru: {
    sour: 'кислое',
    sweet: 'сладкое',
    bitter: 'горькое',
    fresh: 'свежее',
    fruity: 'фруктовое',
    herbal: 'травяное',
    spicy: 'пряное',
    creamy: 'сливочное',
    smoky: 'дымное',
    boozy: 'крепкое',
  },
};

export const daypartLabel: Dict<Daypart> = {
  en: { brunch: 'brunch', aperitif: 'aperitif hour', evening: 'evening', late: 'late night' },
  ru: { brunch: 'бранч', aperitif: 'время аперитива', evening: 'вечер', late: 'поздний вечер' },
};

export const glassLabel: Dict<Glass> = {
  en: {
    highball: 'Highball',
    collins: 'Collins',
    rocks: 'Rocks',
    coupe: 'Coupe',
    martini: 'Martini',
    flute: 'Flute',
    wine: 'Wine glass',
    'copper-mug': 'Copper mug',
    hurricane: 'Hurricane',
    'irish-coffee': 'Irish coffee glass',
    shot: 'Shot',
  },
  ru: {
    highball: 'Хайбол',
    collins: 'Коллинз',
    rocks: 'Рокс',
    coupe: 'Купе',
    martini: 'Мартинка',
    flute: 'Флюте',
    wine: 'Бокал для вина',
    'copper-mug': 'Медная кружка',
    hurricane: 'Харрикейн',
    'irish-coffee': 'Бокал для айриш-кофе',
    shot: 'Шот',
  },
};

export const methodLabel: Dict<Method> = {
  en: {
    build: 'Built',
    stir: 'Stirred',
    shake: 'Shaken',
    blend: 'Blended',
    muddle: 'Muddled',
    layer: 'Layered',
    heat: 'Warm',
  },
  ru: {
    build: 'Билд',
    stir: 'Стир',
    shake: 'Шейк',
    blend: 'Блендер',
    muddle: 'Мадл',
    layer: 'Слоями',
    heat: 'Горячий',
  },
};

export const seasonLabel: Dict<'spring' | 'summer' | 'autumn' | 'winter'> = {
  en: { spring: 'spring', summer: 'summer', autumn: 'autumn', winter: 'winter' },
  ru: { spring: 'весна', summer: 'лето', autumn: 'осень', winter: 'зима' },
};
