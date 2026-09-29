import { describe, expect, it } from 'vitest';
import { preferredLocale } from './proxy';

describe('preferredLocale', () => {
  it('defaults to en', () => {
    expect(preferredLocale(null)).toBe('en');
    expect(preferredLocale('fr-FR,de;q=0.8')).toBe('en');
  });
  it('honors order and q-values', () => {
    expect(preferredLocale('ru-RU,ru;q=0.9,en;q=0.8')).toBe('ru');
    expect(preferredLocale('en;q=0.5,ru;q=0.9')).toBe('ru');
    expect(preferredLocale('ru;q=0,en')).toBe('en');
  });
});
