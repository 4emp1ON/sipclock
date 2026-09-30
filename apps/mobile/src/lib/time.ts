const normalizeSpaces = (s: string) => s.replace(/\s/g, ' ');

/** True when the locale's default clock is 12-hour (en-US) rather than 24-hour (en-GB, ru-RU). */
function uses12Hour(locale: string | undefined): boolean {
  const cycle = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hourCycle;
  return cycle === 'h11' || cycle === 'h12';
}

/** "19:05" for 24-hour locales, "7:05 PM" for 12-hour ones. Midnight is "00:05" / "12:05 AM". */
export function formatTime(date: Date, locale?: string): string {
  const twelve = uses12Hour(locale);
  return normalizeSpaces(
    new Intl.DateTimeFormat(locale, {
      hour: twelve ? 'numeric' : '2-digit',
      minute: '2-digit',
      hourCycle: twelve ? 'h12' : 'h23',
    }).format(date),
  );
}

/** "Fri, Sep 11" (locale-ordered). */
export function formatDayLabel(date: Date, locale?: string): string {
  return normalizeSpaces(
    new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(
      date,
    ),
  );
}

/** "Fri, Sep 11 · 19:05": day and time for history entries. */
export function formatDayTime(date: Date, locale?: string): string {
  return `${formatDayLabel(date, locale)} · ${formatTime(date, locale)}`;
}
