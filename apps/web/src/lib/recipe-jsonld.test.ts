import { describe, expect, it } from 'vitest';
import { recipesById } from '@/lib/catalog';
import { buildRecipeJsonLd, recipePath, serializeJsonLd, toIsoDuration } from './recipe-jsonld';

const gt = recipesById.get('gin-and-tonic');
if (!gt) throw new Error('fixture missing');

describe('toIsoDuration', () => {
  it('formats minutes, hours and mixed', () => {
    expect(toIsoDuration(2)).toBe('PT2M');
    expect(toIsoDuration(60)).toBe('PT1H');
    expect(toIsoDuration(90)).toBe('PT1H30M');
  });
});

describe('buildRecipeJsonLd', () => {
  const en = buildRecipeJsonLd(gt, 'en', 'https://sipclock.app');
  const ru = buildRecipeJsonLd(gt, 'ru', 'https://sipclock.app');

  it('has required schema.org Recipe fields', () => {
    expect(en['@context']).toBe('https://schema.org');
    expect(en['@type']).toBe('Recipe');
    expect(en.name).toBe('Gin & Tonic');
    expect(en.inLanguage).toBe('en');
    expect(en.recipeCategory).toBe('Cocktail');
    expect(en.totalTime).toBe('PT2M');
    expect(en.url).toBe('https://sipclock.app/en/recipes/gin-and-tonic');
    expect(en.recipeIngredient).toContain('50 ml Gin');
    expect(en.recipeIngredient).toContain('Ice (to fill)');
  });

  it('lists instructions as ordered HowToStep', () => {
    expect(en.recipeInstructions).toHaveLength(gt.steps.length);
    expect(en.recipeInstructions[0]).toMatchObject({ '@type': 'HowToStep', position: 1 });
  });

  it('localizes name, ingredients and steps', () => {
    expect(ru.name).toBe('Джин-тоник');
    expect(ru.url).toBe('https://sipclock.app/ru/recipes/gin-and-tonic');
    expect(ru.recipeIngredient).toContain('50 мл Джин');
    expect(ru.recipeInstructions[1]?.text).toBe('Влейте джин.');
  });
});

describe('recipePath', () => {
  it('is locale-prefixed', () => {
    expect(recipePath('ru', 'negroni')).toBe('/ru/recipes/negroni');
  });
});

describe('serializeJsonLd', () => {
  it('escapes < so script tags cannot break out', () => {
    const out = serializeJsonLd({ text: '</script><b>' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out)).toEqual({ text: '</script><b>' });
  });
});
