import { ingredientsById } from '@sipclock/catalog';
import type { Locale } from '@sipclock/i18n';

/** 'ru' for any Russian locale tag, otherwise 'en'. */
export function resolveLocale(tag: string | undefined): Locale {
  return tag?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

/** BCP 47 tag of the device locale as seen by Hermes `Intl`, e.g. "ru-RU". */
export function deviceLocaleTag(): string {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return 'en-US';
  }
}

export function currentLocale(): Locale {
  return resolveLocale(deviceLocaleTag());
}

/** Localized ingredient name; falls back to the id for unknown ingredients. */
export function ingredientName(id: string, locale: Locale): string {
  return ingredientsById.get(id)?.name[locale] ?? id;
}
