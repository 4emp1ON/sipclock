import { describe, expect, it } from 'vitest';
import { BRANDS, cleanText, matchesLocale, mentionsBrand } from './guard.ts';

describe('cleanText', () => {
  it('strips links and collapses whitespace into one line', () => {
    expect(cleanText('See https://example.com/x?y=1 now\nand  www.foo.bar too', 200)).toBe(
      'See now and too',
    );
  });

  it('returns short text unchanged', () => {
    expect(cleanText('  Softer and sweeter ', 50)).toBe('Softer and sweeter');
  });

  it('cuts at a word boundary and appends an ellipsis within the limit', () => {
    const out = cleanText('Drier and spicier than the original, with a longer finish', 30);
    expect(out).toBe('Drier and spicier than the…');
    expect(out.length).toBeLessThanOrEqual(30);
  });

  it('cuts mid-word when there is no usable space', () => {
    const out = cleanText('a'.repeat(50), 10);
    expect(out).toBe(`${'a'.repeat(9)}…`);
  });
});

describe('mentionsBrand', () => {
  it('finds English brands case-insensitively', () => {
    expect(mentionsBrand('Use Aperol instead')).toBe(true);
    expect(mentionsBrand("try HENDRICK'S here")).toBe(true);
    expect(mentionsBrand('Works like Jack Daniel on the rocks')).toBe(true);
  });

  it('finds Russian brands case-insensitively', () => {
    expect(mentionsBrand('Подойдёт Апероль')).toBe(true);
    expect(mentionsBrand('лучше КАМПАРИ')).toBe(true);
  });

  it('passes generic names', () => {
    expect(mentionsBrand('Less botanical, still works')).toBe(false);
    expect(mentionsBrand('Меньше трав, но подойдёт')).toBe(false);
  });
});

describe('matchesLocale', () => {
  it('ru needs mostly Cyrillic', () => {
    expect(matchesLocale('Меньше трав, но подойдёт', 'ru')).toBe(true);
    expect(matchesLocale('Less botanical', 'ru')).toBe(false);
  });

  it('en needs mostly Latin', () => {
    expect(matchesLocale('Less botanical, still works', 'en')).toBe(true);
    expect(matchesLocale('Меньше трав', 'en')).toBe(false);
  });

  it('text without letters matches nothing', () => {
    expect(matchesLocale('123 !!!', 'en')).toBe(false);
    expect(matchesLocale('', 'ru')).toBe(false);
  });
});

describe('BRANDS', () => {
  it('lists a Cyrillic spelling for every brand', () => {
    for (const spellings of BRANDS) {
      expect(
        spellings.some((s) => /\p{Script=Cyrillic}/u.test(s)),
        spellings[0],
      ).toBe(true);
    }
  });
  it('catches Cyrillic spellings in Russian notes', () => {
    expect(mentionsBrand('Возьмите Калуа вместо сиропа')).toBe(true);
    expect(mentionsBrand('Подойдёт Джеймсон')).toBe(true);
    expect(mentionsBrand('Капля Ангостуры')).toBe(true);
    expect(mentionsBrand('Вместо Апероля')).toBe(true);
  });
  it('does not flag the Martini cocktail', () => {
    expect(mentionsBrand('Drier than a classic Martini')).toBe(false);
  });
});
