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
