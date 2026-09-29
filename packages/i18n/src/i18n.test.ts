import { describe, expect, it } from 'vitest';
import { formatAmount, formatNumber } from './amounts.ts';
import { flavorLabel, glassLabel, locales, occasionLabel } from './messages.ts';
import { reasonLine, reasonText } from './reasons.ts';

const names: Record<string, { en: string; ru: string }> = {
  lime: { en: 'lime', ru: 'лайм' },
  lemon: { en: 'lemon', ru: 'лимон' },
  gin: { en: 'gin', ru: 'джин' },
  tonic: { en: 'tonic water', ru: 'тоник' },
};
const name = (id: string, l: 'en' | 'ru') => names[id]?.[l] ?? id;

describe('messages', () => {
  it('has the same keys in every locale', () => {
    for (const dict of [occasionLabel, flavorLabel, glassLabel]) {
      const [en, ...rest] = locales.map((l) => Object.keys(dict[l]).sort());
      for (const keys of rest) expect(keys).toEqual(en);
    }
  });
});

describe('reasons', () => {
  it('describes a swap and ingredients in both languages', () => {
    expect(reasonText({ code: 'swap', need: 'lime', use: 'lemon' }, 'en', name)).toBe(
      'Lemon stands in for lime',
    );
    expect(reasonText({ code: 'in-bar', ingredients: ['gin', 'tonic'] }, 'ru', name)).toBe(
      'У вас есть джин и тоник',
    );
  });

  it('uses sentence case for title-cased catalog names', () => {
    const titled = (id: string, l: 'en' | 'ru') => {
      const n = name(id, l);
      return n.charAt(0).toUpperCase() + n.slice(1);
    };
    expect(reasonText({ code: 'in-bar', ingredients: ['gin', 'lime'] }, 'en', titled)).toBe(
      'You have gin and lime',
    );
    expect(reasonText({ code: 'swap', need: 'lime', use: 'lemon' }, 'ru', titled)).toBe(
      'Лимон вместо: лайм',
    );
  });

  it('joins the strongest reasons into one line', () => {
    const line = reasonLine(
      [
        { code: 'weather', fit: 'hot' },
        { code: 'daypart', daypart: 'aperitif' },
        { code: 'alcohol-free' },
      ],
      'en',
      name,
    );
    expect(line).toBe('Cooling on a hot day. Right for the aperitif hour.');
  });
});

describe('amounts', () => {
  it('formats fractions and plural units', () => {
    expect(formatNumber(1.5, 'en')).toBe('1½');
    expect(formatAmount({ unit: 'oz', value: 0.75 }, 'en')).toBe('¾ oz');
    expect(formatAmount({ unit: 'parts', value: 2 }, 'ru')).toBe('2 части');
    expect(formatAmount({ unit: 'parts', value: 5 }, 'ru')).toBe('5 частей');
    expect(formatAmount({ unit: 'dash', value: 1 }, 'en')).toBe('1 dash');
    expect(formatAmount({ unit: 'ml', value: 45 }, 'ru')).toBe('45 мл');
  });
});

describe('without Intl.ListFormat / Intl.PluralRules (Hermes on Android)', () => {
  it('falls back to built-in list and plural rules', async () => {
    const { ListFormat, PluralRules } = Intl;
    // @ts-expect-error simulate a runtime without these constructors
    delete Intl.ListFormat;
    // @ts-expect-error simulate a runtime without these constructors
    delete Intl.PluralRules;
    try {
      const { listFormat, pluralCategory } = await import('./intl.ts');
      expect(listFormat(['gin', 'lemon'], 'en')).toBe('gin and lemon');
      expect(listFormat(['gin', 'lemon', 'soda'], 'en')).toBe('gin, lemon, and soda');
      expect(listFormat(['джин', 'лимон', 'содовая'], 'ru')).toBe('джин, лимон и содовая');
      expect([1, 2, 5, 11, 21, 22, 25].map((n) => pluralCategory('ru', n))).toEqual([
        'one',
        'few',
        'many',
        'many',
        'one',
        'few',
        'many',
      ]);
      expect(pluralCategory('en', 1)).toBe('one');
      expect(formatAmount({ unit: 'parts', value: 5 }, 'ru')).toBe('5 частей');
      expect(reasonText({ code: 'in-bar', ingredients: ['gin', 'tonic'] }, 'ru', name)).toBe(
        'У вас есть джин и тоник',
      );
    } finally {
      Object.assign(Intl, { ListFormat, PluralRules });
    }
  });

  it('matches Intl where it exists', async () => {
    const { listFormat, pluralCategory } = await import('./intl.ts');
    for (const n of [0, 1, 2, 3, 4, 5, 11, 12, 14, 21, 22, 101, 111]) {
      expect(pluralCategory('ru', n)).toBe(new Intl.PluralRules('ru').select(n));
    }
    expect(listFormat(['a', 'b', 'c'], 'en')).toBe(
      new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(['a', 'b', 'c']),
    );
  });
});
