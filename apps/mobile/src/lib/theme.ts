import { type ColorName, type ThemeName, tokens } from '@sipclock/tokens';

/** Night is the primary theme: anything that is not an explicit light scheme resolves to it. */
export function themeNameForScheme(scheme: string | null | undefined): ThemeName {
  return scheme === 'light' ? 'day' : 'night';
}

export function colorsForTheme(name: ThemeName): Record<ColorName, string> {
  return tokens.colors[name];
}
