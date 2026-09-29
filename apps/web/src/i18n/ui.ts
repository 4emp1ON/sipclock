import type { Occasion } from '@sipclock/domain';
import type { Locale } from '@sipclock/i18n';

export type { Locale };
export const LOCALES: readonly Locale[] = ['en', 'ru'];
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export interface Ui {
  siteTitle: string;
  siteDescription: string;
  nav: { today: string; recipes: string; language: string };
  today: {
    now: string;
    lead: string;
    occasion: string;
    noAlcohol: string;
    anotherIdea: string;
    whyThis: string;
    openRecipe: string;
    alternatives: string;
    noPick: string;
    myBar: string;
    myBarHint: string;
    barCount: (n: number) => string;
    clearBar: string;
    availReady: string;
    availSwap: (n: number) => string;
    availMissing: (names: string) => string;
  };
  recipes: {
    title: string;
    description: string;
    all: string;
    alcoholFree: string;
    filters: string;
    countTemplate: string;
    empty: string;
    min: string;
    metaTitle: (name: string) => string;
    ingredients: string;
    steps: string;
    units: string;
    servings: string;
    ml: string;
    oz: string;
    parts: string;
    zeroProofTwin: string;
    related: string;
    difficulty: Record<1 | 2 | 3, string>;
    yield: (n: number) => string;
    optional: string;
    garnish: string;
    abvLabel: string;
  };
  abv: { free: string; alc: string };
  notFound: { title: string; body: string; back: string };
  footer: { warning: string; adult: string };
  occasions: Record<Occasion, string>;
}

const en: Ui = {
  siteTitle: 'Sipclock - what to make right now',
  siteDescription:
    'Sipclock picks a cocktail for this date and hour, based on your home bar, the occasion and the weather.',
  nav: { today: 'Today', recipes: 'Recipes', language: 'Language' },
  today: {
    now: 'Now',
    lead: 'What to make right now, based on the hour, your home bar and the occasion.',
    occasion: 'Occasion',
    noAlcohol: 'No alcohol',
    anotherIdea: 'Another idea',
    whyThis: 'Why this one',
    openRecipe: 'Open recipe',
    alternatives: 'Or try',
    noPick: 'Nothing fits these filters. Try a different occasion or add ingredients to your bar.',
    myBar: 'My bar',
    myBarHint: 'Tick what you have at home. Saved on this device only.',
    barCount: (n) => (n === 0 ? 'Not set' : `${n} selected`),
    clearBar: 'Clear bar',
    availReady: 'All in your bar',
    availSwap: (n) => `Ready · ${n} swap${n === 1 ? '' : 's'}`,
    availMissing: (names) => `Missing: ${names}`,
  },
  recipes: {
    title: 'Cocktail recipes',
    description:
      'Fifty classic and modern cocktails with ingredients, steps and alcohol-free twins. Pick by occasion or go alcohol-free.',
    all: 'All',
    alcoholFree: 'Alcohol-free',
    filters: 'Filters',
    countTemplate: '{n} recipes',
    empty: 'No recipes match these filters.',
    min: 'min',
    metaTitle: (name) => `${name} recipe`,
    ingredients: 'Ingredients',
    steps: 'Steps',
    units: 'Units',
    servings: 'Servings',
    ml: 'ml',
    oz: 'oz',
    parts: 'parts',
    zeroProofTwin: 'Alcohol-free version',
    related: 'More for the same time of day',
    difficulty: { 1: 'Easy', 2: 'Medium', 3: 'Advanced' },
    yield: (n) => `${n} ${n === 1 ? 'serving' : 'servings'}`,
    optional: 'optional',
    garnish: 'garnish',
    abvLabel: 'Estimated ABV',
  },
  abv: { free: 'Free', alc: 'Alc.' },
  notFound: {
    title: 'Page not found',
    body: 'This page does not exist or has moved.',
    back: 'Back home',
  },
  footer: {
    warning: 'Excessive alcohol consumption is harmful to your health.',
    adult: '18+',
  },
  occasions: {
    'after-work': 'After work',
    date: 'Date',
    party: 'Party',
    chill: 'Chill',
    brunch: 'Brunch',
  },
};

const ru: Ui = {
  siteTitle: 'Sipclock - что приготовить прямо сейчас',
  siteDescription:
    'Sipclock подбирает коктейль под дату и час с учётом вашего домашнего бара и повода.',
  nav: { today: 'Сегодня', recipes: 'Рецепты', language: 'Язык' },
  today: {
    now: 'Сейчас',
    lead: 'Что приготовить прямо сейчас: по времени суток, вашему бару и поводу.',
    occasion: 'Повод',
    noAlcohol: 'Без алкоголя',
    anotherIdea: 'Другая идея',
    whyThis: 'Почему этот',
    openRecipe: 'Открыть рецепт',
    alternatives: 'Или попробуйте',
    noPick: 'Под эти фильтры ничего не подходит. Смените повод или добавьте ингредиенты в бар.',
    myBar: 'Мой бар',
    myBarHint: 'Отметьте, что есть дома. Хранится только на этом устройстве.',
    barCount: (n) => (n === 0 ? 'Не задан' : `Выбрано: ${n}`),
    clearBar: 'Очистить бар',
    availReady: 'Всё есть в баре',
    availSwap: (n) => `Можно готовить · замен: ${n}`,
    availMissing: (names) => `Не хватает: ${names}`,
  },
  recipes: {
    title: 'Рецепты коктейлей',
    description:
      'Пятьдесят классических и современных коктейлей с ингредиентами, шагами и безалкогольными версиями. Выбирайте по поводу или без алкоголя.',
    all: 'Все',
    alcoholFree: 'Без алкоголя',
    filters: 'Фильтры',
    countTemplate: 'Рецептов: {n}',
    empty: 'Нет рецептов под эти фильтры.',
    min: 'мин',
    metaTitle: (name) => `${name}: рецепт`,
    ingredients: 'Ингредиенты',
    steps: 'Приготовление',
    units: 'Единицы',
    servings: 'Порции',
    ml: 'мл',
    oz: 'oz',
    parts: 'части',
    zeroProofTwin: 'Версия без алкоголя',
    related: 'Ещё на это время суток',
    difficulty: { 1: 'Просто', 2: 'Средне', 3: 'Сложно' },
    yield: (n) => `${n} ${n === 1 ? 'порция' : n < 5 ? 'порции' : 'порций'}`,
    optional: 'по желанию',
    garnish: 'украшение',
    abvLabel: 'Ориентировочная крепость',
  },
  abv: { free: 'Без алк.', alc: 'Алк.' },
  notFound: {
    title: 'Страница не найдена',
    body: 'Такой страницы нет или она переехала.',
    back: 'На главную',
  },
  footer: {
    warning: 'Чрезмерное употребление алкоголя вредит вашему здоровью.',
    adult: '18+',
  },
  occasions: {
    'after-work': 'После работы',
    date: 'Свидание',
    party: 'Вечеринка',
    chill: 'Отдых',
    brunch: 'Бранч',
  },
};

const dictionaries: Record<Locale, Ui> = { en, ru };

export function getUi(locale: Locale): Ui {
  return dictionaries[locale];
}
