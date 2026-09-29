// Shape of the design system's tokens.json (the Design System artifact is the source of truth).

export interface ColorToken {
  name: string;
  value: string | Record<string, string>;
  usage?: string;
}

export interface ScalarToken {
  name: string;
  value: string;
  usage?: string;
}

export interface TypeStyle {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  letterSpacing?: string;
  usage?: string;
}

export interface TokensSource {
  name: string;
  color: { themes: { id: string; name: string }[]; tokens: ColorToken[] };
  type: {
    families: Record<string, string>;
    groups: { name: string; family: string; styles: TypeStyle[] }[];
  };
  spacing: { tokens: ScalarToken[] };
  radius: { tokens: ScalarToken[] };
  shadow?: { tokens: ColorToken[] };
}

export interface ResolvedTokens {
  themes: string[];
  colors: Record<string, Record<string, string>>;
  shadows: Record<string, Record<string, string>>;
  space: Record<string, string>;
  radius: Record<string, string>;
  fonts: Record<string, string>;
  text: Record<string, Omit<TypeStyle, 'name' | 'usage'> & { family: string }>;
}

/** Resolves per-theme values; a token without a value for a theme inherits the first theme's. */
export function resolve(src: TokensSource): ResolvedTokens {
  const themes = src.color.themes.map((t) => t.id);
  const first = themes[0];
  if (!first) throw new Error('tokens.json: color.themes is empty');

  const perTheme = (tokens: ColorToken[]) => {
    const out: Record<string, Record<string, string>> = Object.fromEntries(
      themes.map((t) => [t, {}]),
    );
    for (const token of tokens) {
      for (const theme of themes) {
        const v =
          typeof token.value === 'string'
            ? token.value
            : (token.value[theme] ?? token.value[first]);
        if (v === undefined)
          throw new Error(`tokens.json: ${token.name} has no value for ${theme}`);
        (out[theme] as Record<string, string>)[token.name] = v;
      }
    }
    return out;
  };

  const scalar = (tokens: ScalarToken[]) =>
    Object.fromEntries(tokens.map((t) => [t.name, t.value]));

  const text: ResolvedTokens['text'] = {};
  for (const group of src.type.groups) {
    for (const { name, usage: _usage, ...style } of group.styles) {
      text[name] = { ...style, family: group.family };
    }
  }

  return {
    themes,
    colors: perTheme(src.color.tokens),
    shadows: perTheme(src.shadow?.tokens ?? []),
    space: scalar(src.spacing.tokens),
    radius: scalar(src.radius.tokens),
    fonts: src.type.families,
    text,
  };
}

/** WCAG 2 relative luminance contrast for #rrggbb colors. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m?.[1]) throw new Error(`contrast(): expected #rrggbb, got ${hex}`);
    const n = Number.parseInt(m[1], 16);
    const [r, g, bl] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
