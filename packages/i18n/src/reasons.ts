import type { Reason } from '@sipclock/domain';
import { listFormat } from './intl.ts';
import { daypartLabel, flavorLabel, type Locale, occasionLabel, seasonLabel } from './messages.ts';

/** Resolves an ingredient id to its display name in the given locale. */
export type IngredientName = (id: string, locale: Locale) => string;

/** One short clause per reason. Apps join the first two or three into the "why this one" line. */
export function reasonText(reason: Reason, locale: Locale, displayName: IngredientName): string {
  const ru = locale === 'ru';
  // Catalog names are title-cased for lists and headings; inside a sentence they read as common nouns.
  const name: IngredientName = (id, l) => lowerFirst(displayName(id, l));
  const names = (ids: string[]) =>
    listFormat(
      ids.map((id) => name(id, locale)),
      locale,
    );
  switch (reason.code) {
    case 'daypart':
      return ru
        ? `Подходит под ${daypartLabel.ru[reason.daypart]}`
        : `Right for the ${daypartLabel.en[reason.daypart]}`;
    case 'weekend':
      return ru ? 'Выходные — можно не спешить' : 'It’s the weekend, no rush';
    case 'weather':
      if (reason.fit === 'hot') return ru ? 'Освежает в жару' : 'Cooling on a hot day';
      if (reason.fit === 'cold') return ru ? 'Согревает в холод' : 'Warming on a cold day';
      return ru ? 'Уютный выбор для дождя' : 'A cosy pick for the rain';
    case 'season':
      return ru
        ? `Сезонное: ${seasonLabel.ru[reason.season]}`
        : `In season for ${seasonLabel.en[reason.season]}`;
    case 'occasion':
      return ru
        ? `Для повода «${occasionLabel.ru[reason.occasion]}»`
        : `Made for ${occasionLabel.en[reason.occasion].toLowerCase()}`;
    case 'taste': {
      const f = listFormat(
        reason.flavors.map((x) => flavorLabel[locale][x]),
        locale,
      );
      return ru ? `Вы любите ${f}` : `You like ${f}`;
    }
    case 'in-bar':
      return ru
        ? `У вас есть ${names(reason.ingredients)}`
        : `You have ${names(reason.ingredients)}`;
    case 'swap':
      return ru
        ? `${capitalize(name(reason.use, locale))} вместо: ${name(reason.need, locale)}`
        : `${capitalize(name(reason.use, locale))} stands in for ${name(reason.need, locale)}`;
    case 'missing':
      return ru
        ? `Не хватает: ${names(reason.ingredients)}`
        : `Missing: ${names(reason.ingredients)}`;
    case 'alcohol-free':
      return ru ? 'Без алкоголя' : 'Alcohol free';
  }
}

/** The "why this one" line: up to `max` clauses joined into one sentence. */
export function reasonLine(
  reasons: Reason[],
  locale: Locale,
  name: IngredientName,
  max = 2,
): string {
  const parts = reasons.slice(0, max).map((r) => reasonText(r, locale, name));
  if (parts.length === 0) return '';
  return `${parts.join('. ')}.`;
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLocaleLowerCase() + s.slice(1);
}

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}
