import { tokens } from '@sipclock/tokens';

import { fontFamilyFor, letterSpacingPx, textStyle } from './typography';

describe('fontFamilyFor', () => {
  it('builds the expo-font family names', () => {
    expect(fontFamilyFor('display', 600)).toBe('Unbounded_600SemiBold');
    expect(fontFamilyFor('text', 400)).toBe('Onest_400Regular');
  });

  it('throws for weights that are not loaded', () => {
    expect(() => fontFamilyFor('text', 300)).toThrow();
  });
});

describe('letterSpacingPx', () => {
  it('converts em to pixels', () => {
    expect(letterSpacingPx('-0.02em', 56)).toBeCloseTo(-1.12);
  });
  it('is undefined without a value', () => {
    expect(letterSpacingPx(undefined, 14)).toBeUndefined();
  });
});

describe('textStyle', () => {
  it('maps time-hero to Unbounded 56/60 with tabular numerals', () => {
    const s = textStyle('time-hero');
    expect(s).toMatchObject({
      fontFamily: 'Unbounded_600SemiBold',
      fontSize: 56,
      lineHeight: 60,
      fontVariant: ['tabular-nums'],
    });
  });

  it('resolves every token text style to a loadable font', () => {
    for (const variant of Object.keys(tokens.text) as (keyof typeof tokens.text)[]) {
      expect(textStyle(variant).fontFamily).toMatch(/^(Unbounded|Onest)_\d{3}\w+$/);
    }
  });
});
