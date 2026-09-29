import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { emitUniwind } from './emit.ts';
import { contrast, resolve, type TokensSource } from './model.ts';

const source = JSON.parse(
  readFileSync(new URL('./tokens.json', import.meta.url), 'utf8'),
) as TokensSource;
const t = resolve(source);

describe('design tokens', () => {
  it('defines every color in every theme', () => {
    const names = source.color.tokens.map((c) => c.name);
    for (const theme of t.themes) expect(Object.keys(t.colors[theme] ?? {})).toEqual(names);
  });

  // Pairs the design system's usage notes promise. Text 4.5:1, control shapes 3:1 (WCAG 2.2).
  const pairs: [fg: string, bg: string, min: number][] = [
    ['ink', 'bg', 4.5],
    ['ink', 'surface', 4.5],
    ['ink', 'surface-raised', 4.5],
    ['ink-muted', 'bg', 4.5],
    ['ink-muted', 'surface', 4.5],
    ['ink-muted', 'surface-raised', 4.5],
    ['on-primary', 'primary', 4.5],
    ['on-accent', 'accent', 4.5],
    ['on-mint', 'mint', 4.5],
    ['primary', 'bg', 3],
    ['focus', 'bg', 3],
    ['focus', 'surface', 3],
  ];

  for (const theme of ['night', 'day']) {
    for (const [fg, bg, min] of pairs) {
      it(`${theme}: ${fg} on ${bg} ≥ ${min}:1`, () => {
        const c = t.colors[theme] ?? {};
        expect(contrast(c[fg] as string, c[bg] as string)).toBeGreaterThanOrEqual(min);
      });
    }
  }
});

describe('uniwind output', () => {
  const css = emitUniwind(t);

  it('declares every color for the dark (night) and light (day) variants', () => {
    for (const [variant, theme] of [
      ['dark', 'night'],
      ['light', 'day'],
    ] as const) {
      const start = css.indexOf(`@variant ${variant} {`);
      expect(start).toBeGreaterThan(-1);
      const block = css.slice(start, css.indexOf('}', start));
      for (const [name, value] of Object.entries(t.colors[theme] ?? {})) {
        expect(block).toContain(`--color-${name}: ${value};`);
      }
    }
  });

  it('declares radius and the shadow utility', () => {
    for (const [name, value] of Object.entries(t.radius))
      expect(css).toContain(`--${name}: ${value};`);
    expect(css).toContain('@utility shadow-card');
  });
});
