// Hermes on Android ships without Intl.ListFormat and Intl.PluralRules, so these helpers fall back to
// hand-written rules for the two supported locales when the runtime lacks them.
import type { Locale } from './messages.ts';

type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

export function pluralCategory(locale: Locale, n: number): PluralCategory {
  if (typeof Intl !== 'undefined' && typeof Intl.PluralRules === 'function') {
    return new Intl.PluralRules(locale).select(n);
  }
  if (!Number.isInteger(n)) return 'other';
  if (locale === 'en') return n === 1 ? 'one' : 'other';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'one';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
  return 'many';
}

export function listFormat(items: string[], locale: Locale): string {
  if (typeof Intl !== 'undefined' && typeof Intl.ListFormat === 'function') {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items);
  }
  const and = locale === 'ru' ? ' и ' : ' and ';
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return items.join(and);
  const head = items.slice(0, -1).join(', ');
  return `${head}${locale === 'en' ? ',' : ''}${and}${items[items.length - 1]}`;
}
