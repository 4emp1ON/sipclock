import { describe, expect, it } from 'vitest';
import { hashString, mulberry32, unitJitter } from './random.ts';
import {
  daypartOf,
  defaultRules,
  isWeekend,
  RULES_VERSION,
  seasonOf,
  strengthOf,
  weatherFits,
} from './rules.ts';

describe('rules', () => {
  it('has a version', () => {
    expect(defaultRules.version).toBe(RULES_VERSION);
  });
  it.each([
    [9, null],
    [10, 'brunch'],
    [13, 'brunch'],
    [14, null],
    [15, null],
    [16, 'aperitif'],
    [18, 'aperitif'],
    [19, 'evening'],
    [22, 'evening'],
    [23, 'late'],
    [0, 'late'],
    [2, 'late'],
    [3, null],
  ])('daypart at %i:00 is %s', (hour, expected) => {
    expect(daypartOf(hour)).toBe(expected);
  });
  it('weekend = Sat/Sun and Friday from 17', () => {
    expect(isWeekend({ weekday: 6, hour: 8 })).toBe(true);
    expect(isWeekend({ weekday: 0, hour: 8 })).toBe(true);
    expect(isWeekend({ weekday: 5, hour: 16 })).toBe(false);
    expect(isWeekend({ weekday: 5, hour: 17 })).toBe(true);
    expect(isWeekend({ weekday: 3, hour: 20 })).toBe(false);
  });
  it('season by hemisphere', () => {
    expect(seasonOf(1, 'north')).toBe('winter');
    expect(seasonOf(12, 'north')).toBe('winter');
    expect(seasonOf(4, 'north')).toBe('spring');
    expect(seasonOf(7, 'north')).toBe('summer');
    expect(seasonOf(10, 'north')).toBe('autumn');
    expect(seasonOf(1, 'south')).toBe('summer');
    expect(seasonOf(7, 'south')).toBe('winter');
    expect(seasonOf(4, 'south')).toBe('autumn');
    expect(seasonOf(10, 'south')).toBe('spring');
    expect(seasonOf(12, 'south')).toBe('summer');
  });
  it('weather fits', () => {
    expect(weatherFits({ tempC: 25, condition: 'clear' })).toEqual(['hot']);
    expect(weatherFits({ tempC: 8, condition: 'cloudy' })).toEqual(['cold']);
    expect(weatherFits({ tempC: 15, condition: 'rain' })).toEqual(['rainy']);
    expect(weatherFits({ tempC: 2, condition: 'snow' })).toEqual(['cold', 'rainy']);
    expect(weatherFits({ tempC: 18, condition: 'clear' })).toEqual(['mild']);
  });
  it('strength bands', () => {
    expect(strengthOf(0)).toBe('zero');
    expect(strengthOf(1)).toBe('light');
    expect(strengthOf(10)).toBe('light');
    expect(strengthOf(11)).toBe('medium');
    expect(strengthOf(20)).toBe('medium');
    expect(strengthOf(21)).toBe('strong');
  });
});

describe('random', () => {
  it('mulberry32 is reproducible', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('hash is stable', () => {
    expect(hashString('negroni')).toBe(hashString('negroni'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });
  it('jitter is in [0,1) and varies with seed', () => {
    const vals = [1, 2, 3, 4, 5].map((s) => unitJitter(s, 'negroni'));
    for (const v of vals) expect(v >= 0 && v < 1).toBe(true);
    expect(new Set(vals).size).toBeGreaterThan(1);
  });
});
