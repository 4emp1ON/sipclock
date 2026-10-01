import { describe, expect, it } from 'vitest';
import { CLAUDE_EXCLUDED, decideRegion, primaryLanguage, RU_COUNTRIES } from './region.ts';

const base = { country: 'US', locale: 'en-US', pinned: false };

describe('decideRegion', () => {
  it('sends a known non-Russian country with a non-ru locale to Claude without pinning', () => {
    expect(decideRegion(base, true)).toEqual({ provider: 'anthropic', pin: false });
    expect(decideRegion({ ...base, locale: undefined }, true)).toEqual({
      provider: 'anthropic',
      pin: false,
    });
  });

  it.each([...CLAUDE_EXCLUDED].filter((c) => !RU_COUNTRIES.has(c)))(
    '%s is not sent to Claude and does not pin',
    (country) => {
      expect(decideRegion({ ...base, country }, true)).toEqual({ provider: 'yandex', pin: false });
    },
  );

  it('uses Yandex when Anthropic is not enabled', () => {
    expect(decideRegion(base, false)).toEqual({ provider: 'yandex', pin: false });
  });

  it.each([...RU_COUNTRIES])('%s goes to Yandex and pins the account', (country) => {
    expect(decideRegion({ ...base, country }, true)).toEqual({ provider: 'yandex', pin: true });
  });

  it('a ru locale goes to Yandex and pins even from a foreign country', () => {
    expect(decideRegion({ ...base, locale: 'ru-RU' }, true)).toEqual({
      provider: 'yandex',
      pin: true,
    });
    expect(decideRegion({ ...base, locale: 'RU' }, true)).toEqual({
      provider: 'yandex',
      pin: true,
    });
  });

  it('does not pin again when already pinned, and never leaves Yandex', () => {
    expect(decideRegion({ country: 'RU', locale: 'ru', pinned: true }, true)).toEqual({
      provider: 'yandex',
      pin: false,
    });
    expect(decideRegion({ ...base, pinned: true }, true)).toEqual({
      provider: 'yandex',
      pin: false,
    });
  });

  it('an unknown country goes to Yandex without pinning', () => {
    expect(decideRegion({ ...base, country: undefined }, true)).toEqual({
      provider: 'yandex',
      pin: false,
    });
  });
});

describe('primaryLanguage', () => {
  it('takes the first tag without its quality value', () => {
    expect(primaryLanguage('ru-RU,ru;q=0.9,en;q=0.8')).toBe('ru-RU');
    expect(primaryLanguage('en;q=0.5')).toBe('en');
    expect(primaryLanguage('  fr-CH , de')).toBe('fr-CH');
  });

  it('returns undefined for a missing or empty header', () => {
    expect(primaryLanguage(undefined)).toBeUndefined();
    expect(primaryLanguage('')).toBeUndefined();
    expect(primaryLanguage(' ,en')).toBeUndefined();
  });
});
