import { tokens } from '@sipclock/tokens';
import type { TextStyle } from 'react-native';

export type TextVariant = keyof typeof tokens.text;

type FamilyKey = 'display' | 'text';

const FAMILY_PREFIX: Record<FamilyKey, string> = { display: 'Unbounded', text: 'Onest' };

const WEIGHT_NAME: Record<number, string> = {
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
};

/** Name a font is registered under in expo-font, e.g. `Unbounded_600SemiBold` (see src/lib/fonts.ts). */
export function fontFamilyFor(family: FamilyKey, weight: number): string {
  const name = WEIGHT_NAME[weight];
  if (!name) throw new Error(`No ${family} font loaded for weight ${weight}`);
  return `${FAMILY_PREFIX[family]}_${weight}${name}`;
}

/** Tokens use em letter spacing; React Native wants logical pixels. */
export function letterSpacingPx(value: string | undefined, fontSize: number): number | undefined {
  if (!value) return undefined;
  return value.endsWith('em') ? Number.parseFloat(value) * fontSize : Number.parseFloat(value);
}

/** React Native style for a design-system text style. Times get tabular numerals. */
export function textStyle(variant: TextVariant): TextStyle {
  const s: {
    fontFamily: FamilyKey;
    fontSize: number;
    lineHeight: number;
    fontWeight: number;
    letterSpacing?: string;
  } = tokens.text[variant];
  const letterSpacing = letterSpacingPx(s.letterSpacing, s.fontSize);
  return {
    fontFamily: fontFamilyFor(s.fontFamily, s.fontWeight),
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    ...(letterSpacing === undefined ? {} : { letterSpacing }),
    ...(variant === 'time-hero' || variant === 'clock' ? { fontVariant: ['tabular-nums'] } : {}),
  };
}
