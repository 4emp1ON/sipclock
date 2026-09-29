import { describe, expect, it } from 'vitest';
import { recipes } from '@/data/recipes';
import { buildRecipeJsonLd, serializeJsonLd, toIsoDuration } from './recipe-jsonld';

const gt = recipes[0];
if (!gt) throw new Error('fixture missing');

describe('toIsoDuration', () => {
  it('formats minutes, hours and mixed', () => {
    expect(toIsoDuration(2)).toBe('PT2M');
    expect(toIsoDuration(60)).toBe('PT1H');
    expect(toIsoDuration(90)).toBe('PT1H30M');
  });
});

describe('buildRecipeJsonLd', () => {
  const ld = buildRecipeJsonLd(gt, 'https://sipclock.app');

  it('has required schema.org Recipe fields', () => {
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('Recipe');
    expect(ld.name).toBe('Gin & Tonic');
    expect(ld.recipeCategory).toBe('Cocktail');
    expect(ld.totalTime).toBe('PT2M');
    expect(ld.url).toBe('https://sipclock.app/recipes/gin-and-tonic');
    expect(ld.recipeIngredient).toContain('50 ml London dry gin');
  });

  it('lists instructions as ordered HowToStep', () => {
    expect(ld.recipeInstructions).toHaveLength(gt.steps.length);
    expect(ld.recipeInstructions[0]).toMatchObject({ '@type': 'HowToStep', position: 1 });
  });
});

describe('serializeJsonLd', () => {
  it('escapes < so script tags cannot break out', () => {
    const out = serializeJsonLd({ text: '</script><b>' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out)).toEqual({ text: '</script><b>' });
  });
});
