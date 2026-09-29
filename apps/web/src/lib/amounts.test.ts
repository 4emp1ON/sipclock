import { describe, expect, it } from 'vitest';
import { formatIngredientAmount } from './amounts';

describe('formatIngredientAmount', () => {
  const gin = { unit: 'ml', value: 45 } as const;

  it('defaults to ml for one serving', () => {
    expect(formatIngredientAmount(gin, 'en')).toBe('45 ml');
    expect(formatIngredientAmount(gin, 'ru')).toBe('45 мл');
  });

  it('scales by servings', () => {
    expect(formatIngredientAmount(gin, 'en', { servings: 4 })).toBe('180 ml');
  });

  it('converts to oz and to parts', () => {
    expect(formatIngredientAmount(gin, 'en', { unit: 'oz' })).toBe('1½ oz');
    expect(formatIngredientAmount(gin, 'en', { unit: 'parts', partsBase: 15 })).toBe('3 parts');
    expect(formatIngredientAmount(gin, 'en', { unit: 'parts', partsBase: 15, servings: 2 })).toBe(
      '3 parts',
    );
  });

  it('keeps non-volume amounts and localizes them', () => {
    expect(formatIngredientAmount({ unit: 'fill' }, 'en')).toBe('to fill');
    expect(formatIngredientAmount({ unit: 'dash', value: 2 }, 'ru')).toBe('2 дэша');
  });
});
