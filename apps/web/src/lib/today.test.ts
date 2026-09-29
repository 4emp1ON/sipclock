import type { Availability } from '@sipclock/domain';
import { describe, expect, it } from 'vitest';
import { getUi } from '@/i18n/ui';
import {
  availabilityPill,
  buildInput,
  formatClock,
  momentFromDate,
  type TodayState,
} from './today';

const base = (over: Partial<TodayState> = {}): TodayState => ({
  moment: momentFromDate(new Date(2026, 8, 25, 19, 5)),
  occasion: null,
  alcoholFree: false,
  bar: [],
  seed: 1,
  recent: [],
  ...over,
});

describe('momentFromDate', () => {
  it('maps local fields (1-based month, weekday 0=Sunday)', () => {
    expect(momentFromDate(new Date(2026, 8, 25, 19, 5))).toEqual({
      year: 2026,
      month: 9,
      day: 25,
      weekday: 5,
      hour: 19,
      minute: 5,
      hemisphere: 'north',
    });
  });
});

describe('formatClock', () => {
  it('zero-pads', () => {
    expect(formatClock(momentFromDate(new Date(2026, 0, 1, 7, 3)))).toBe('07:03');
  });
});

describe('buildInput', () => {
  it('sends bar: null for an empty bar and no occasion by default', () => {
    const input = buildInput(base());
    expect(input.bar).toBeNull();
    expect(input.occasion).toBeUndefined();
    expect(input.weather).toBeNull();
    expect(input.alternatives).toBe(3);
  });

  it('passes bar, occasion, alcohol-free, recent and seed through', () => {
    const input = buildInput(
      base({ bar: ['gin'], occasion: 'date', alcoholFree: true, recent: ['negroni'], seed: 9 }),
    );
    expect(input).toMatchObject({
      bar: ['gin'],
      occasion: 'date',
      alcoholFree: true,
      recent: ['negroni'],
      seed: 9,
    });
  });
});

describe('availabilityPill', () => {
  const en = getUi('en');
  const ru = getUi('ru');
  const swap: Availability = { status: 'swap', swaps: [{ need: 'gin', use: 'vodka' }] };
  const missing: Availability = { status: 'missing', missing: ['gin', 'lime'], swaps: [] };

  it('maps ready, swap, missing and unknown', () => {
    expect(availabilityPill({ status: 'ready' }, en, 'en')).toEqual({
      tone: 'ready',
      label: 'All in your bar',
    });
    expect(availabilityPill(swap, en, 'en')).toEqual({ tone: 'swap', label: 'Ready · 1 swap' });
    expect(availabilityPill(missing, en, 'en')).toEqual({
      tone: 'missing',
      label: 'Missing: Gin, Lime',
    });
    expect(availabilityPill({ status: 'unknown' }, en, 'en')).toBeNull();
  });

  it('localizes ingredient names', () => {
    expect(availabilityPill(missing, ru, 'ru')?.label).toBe('Не хватает: Джин, Лайм');
  });
});
