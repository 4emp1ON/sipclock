import { describe, expect, it } from 'vitest';
import { config, preferredLocale } from './proxy';

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

describe('proxy matcher', () => {
  const [pattern = ''] = config.matcher;
  const matches = (path: string) => new RegExp(`^${pattern}$`).test(path);
  it('leaves the API proxy alone so /api/* is never locale-redirected', () => {
    expect(matches('/api/auth/get-session')).toBe(false);
    expect(matches('/api/me/data')).toBe(false);
  });
  it('still handles pages', () => {
    expect(matches('/')).toBe(true);
    expect(matches('/recipes')).toBe(true);
    expect(matches('/sign-in')).toBe(true);
    expect(matches('/en/account')).toBe(true);
  });
});
