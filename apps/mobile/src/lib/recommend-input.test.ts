import { buildRecommendInput, momentFromDate } from './recommend-input';

describe('momentFromDate', () => {
  it('maps local fields, 1-based month and Sunday-based weekday', () => {
    // Fri, 11 Sep 2026 19:05 local
    expect(momentFromDate(new Date(2026, 8, 11, 19, 5))).toEqual({
      year: 2026,
      month: 9,
      day: 11,
      weekday: 5,
      hour: 19,
      minute: 5,
      hemisphere: 'north',
    });
  });

  it('maps Sunday to 0 and Saturday to 6', () => {
    expect(momentFromDate(new Date(2026, 8, 13, 0, 0)).weekday).toBe(0);
    expect(momentFromDate(new Date(2026, 8, 12, 23, 59)).weekday).toBe(6);
  });

  it('handles January and December', () => {
    expect(momentFromDate(new Date(2027, 0, 1)).month).toBe(1);
    expect(momentFromDate(new Date(2026, 11, 31)).month).toBe(12);
  });

  it('accepts a hemisphere', () => {
    expect(momentFromDate(new Date(2026, 8, 11), 'south').hemisphere).toBe('south');
  });
});

describe('buildRecommendInput', () => {
  const base = {
    now: new Date(2026, 8, 11, 19, 5),
    occasion: null,
    alcoholFree: false,
    bar: ['gin'],
    recent: ['negroni'],
    seed: 7,
  };

  it('passes bar, recent and seed through and has no weather', () => {
    const input = buildRecommendInput(base);
    expect(input.bar).toEqual(['gin']);
    expect(input.recent).toEqual(['negroni']);
    expect(input.seed).toBe(7);
    expect(input.weather).toBeNull();
    expect(input.occasion).toBeUndefined();
    expect(input.alcoholFree).toBeUndefined();
  });

  it('treats a loading (null) or empty bar as unknown', () => {
    expect(buildRecommendInput({ ...base, bar: null }).bar).toBeNull();
    expect(buildRecommendInput({ ...base, bar: [] }).bar).toBeNull();
  });

  it('sets occasion and alcoholFree only when chosen', () => {
    expect(buildRecommendInput({ ...base, occasion: 'date' }).occasion).toBe('date');
    expect(buildRecommendInput({ ...base, alcoholFree: true }).alcoholFree).toBe(true);
  });
});
