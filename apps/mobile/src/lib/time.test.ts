import { formatDayLabel, formatDayTime, formatTime } from './time';

// Local-time constructor: formatting is done in the runtime's time zone.
const at = (h: number, m: number) => new Date(2026, 8, 11, h, m);

describe('formatTime', () => {
  it('formats 24-hour locales with zero-padded hours', () => {
    expect(formatTime(at(19, 5), 'en-GB')).toBe('19:05');
    expect(formatTime(at(7, 5), 'ru-RU')).toBe('07:05');
  });

  it('formats 12-hour locales with a day period', () => {
    expect(formatTime(at(19, 5), 'en-US')).toBe('7:05 PM');
    expect(formatTime(at(9, 30), 'en-US')).toBe('9:30 AM');
  });

  it('renders midnight as 00:xx in 24-hour and 12:xx AM in 12-hour locales', () => {
    expect(formatTime(at(0, 0), 'en-GB')).toBe('00:00');
    expect(formatTime(at(0, 7), 'en-US')).toBe('12:07 AM');
  });

  it('renders noon as 12:00 PM in 12-hour locales', () => {
    expect(formatTime(at(12, 0), 'en-US')).toBe('12:00 PM');
  });
});

describe('formatDayLabel', () => {
  it('gives a short weekday, month and day', () => {
    expect(formatDayLabel(at(19, 0), 'en-US')).toBe('Fri, Sep 11');
  });
});

describe('formatDayTime', () => {
  it('joins the day and the time', () => {
    expect(formatDayTime(at(19, 5), 'en-US')).toBe('Fri, Sep 11 · 7:05 PM');
  });
});
