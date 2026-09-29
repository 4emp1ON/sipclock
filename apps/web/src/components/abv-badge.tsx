export function AbvBadge({ abv }: { abv: number }) {
  const free = abv === 0;
  return (
    <span
      className={`tabular inline-flex min-h-8 items-center gap-1 rounded-pill px-3 text-sm font-semibold ${
        free ? 'bg-mint text-on-mint' : 'bg-accent text-on-accent'
      }`}
    >
      <span>{free ? '0%' : `${abv}%`}</span>
      <span>{free ? 'Free' : 'Alc.'}</span>
    </span>
  );
}
