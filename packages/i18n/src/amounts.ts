import type { Localized } from '@sipclock/domain';
import { pluralCategory } from './intl.ts';
import type { Locale } from './messages.ts';

/** Structured amount as produced by the engine's unit conversion. */
export type DisplayAmount =
  | { unit: 'ml' | 'oz' | 'parts' | 'dash' | 'barspoon'; value: number }
  | { unit: 'piece'; value: number; noun?: Localized }
  | { unit: 'top' }
  | { unit: 'fill' };

const plural = (locale: Locale, n: number, forms: Record<string, string>) =>
  forms[pluralCategory(locale, n)] ?? forms.other ?? '';

/** 1.5 → "1½", 0.25 → "¼"; other values keep up to one decimal. */
export function formatNumber(n: number, locale: Locale): string {
  const whole = Math.trunc(n);
  const frac = Math.round((n - whole) * 100) / 100;
  const glyph = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[frac];
  if (glyph) return whole === 0 ? glyph : `${whole}${glyph}`;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);
}

export function formatAmount(a: DisplayAmount, locale: Locale): string {
  const ru = locale === 'ru';
  switch (a.unit) {
    case 'ml':
      return `${formatNumber(a.value, locale)} ${ru ? 'мл' : 'ml'}`;
    case 'oz':
      return `${formatNumber(a.value, locale)} oz`;
    case 'parts':
      return `${formatNumber(a.value, locale)} ${ru ? plural(locale, a.value, { one: 'часть', few: 'части', many: 'частей', other: 'части' }) : plural(locale, a.value, { one: 'part', other: 'parts' })}`;
    case 'dash':
      return `${formatNumber(a.value, locale)} ${ru ? plural(locale, a.value, { one: 'дэш', few: 'дэша', many: 'дэшей', other: 'дэша' }) : plural(locale, a.value, { one: 'dash', other: 'dashes' })}`;
    case 'barspoon':
      return `${formatNumber(a.value, locale)} ${ru ? 'бар. ложк.' : plural(locale, a.value, { one: 'barspoon', other: 'barspoons' })}`;
    case 'piece':
      return a.noun
        ? `${formatNumber(a.value, locale)} ${a.noun[locale]}`
        : formatNumber(a.value, locale);
    case 'top':
      return ru ? 'долить' : 'top up';
    case 'fill':
      return ru ? 'доверху' : 'to fill';
  }
}
