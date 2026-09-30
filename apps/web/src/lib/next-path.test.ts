import { describe, expect, it } from 'vitest';
import { safeNextPath } from './next-path';

describe('safeNextPath', () => {
  it('accepts same-site localized paths, keeping query and hash', () => {
    expect(safeNextPath('/en/recipes/negroni', 'en')).toBe('/en/recipes/negroni');
    expect(safeNextPath('/ru/recipes?x=1#a', 'ru')).toBe('/ru/recipes?x=1#a');
  });
  it('falls back to Today for anything else', () => {
    for (const bad of [
      null,
      '',
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/\t/evil.example',
      'javascript:alert(1)',
      'recipes',
      '/api/auth/x',
      '/fr/recipes',
      '/en/sign-in',
    ]) {
      expect(safeNextPath(bad, 'ru')).toBe('/ru');
    }
  });
});
