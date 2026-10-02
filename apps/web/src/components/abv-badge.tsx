export interface AbvLabels {
  /** Word shown on the mint badge for alcohol-free drinks. */
  free: string;
  /**
   * Accessible name for an alcoholic drink, `{percent}` standing for the number. A string, not a function:
   * labels cross from server pages into client components.
   */
  aria: string;
}

const EN: AbvLabels = { free: 'Alcohol-free', aria: '{percent} percent alcohol' };

/** Strength of the finished drink: the number on accent, or the word on mint (never a bare 0%). */
export function AbvBadge({ abv, labels = EN }: { abv: number; labels?: AbvLabels }) {
  const free = abv === 0;
  return (
    <span
      role="img"
      aria-label={free ? labels.free : labels.aria.replace('{percent}', String(abv))}
      className={`inline-flex min-h-8 shrink-0 items-center whitespace-nowrap rounded-sm px-3 ${
        free
          ? 'bg-mint text-on-mint text-sm font-semibold'
          : 'bg-accent text-on-accent font-display tabular text-base font-bold leading-[18px]'
      }`}
    >
      {free ? labels.free : `${abv}%`}
    </span>
  );
}
