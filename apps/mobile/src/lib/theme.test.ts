import { tokens } from '@sipclock/tokens';

import { colorsForTheme, themeNameForScheme } from './theme';

describe('themeNameForScheme', () => {
  it('maps the light system scheme to day', () => {
    expect(themeNameForScheme('light')).toBe('day');
  });

  it('defaults everything else to night', () => {
    expect(themeNameForScheme('dark')).toBe('night');
    expect(themeNameForScheme(null)).toBe('night');
    expect(themeNameForScheme(undefined)).toBe('night');
    expect(themeNameForScheme('unspecified')).toBe('night');
  });
});

describe('colorsForTheme', () => {
  it('returns the token palette for each theme', () => {
    expect(colorsForTheme('night')).toBe(tokens.colors.night);
    expect(colorsForTheme('day').bg).toBe(tokens.colors.day.bg);
    expect(colorsForTheme('night').bg).not.toBe(colorsForTheme('day').bg);
  });
});
