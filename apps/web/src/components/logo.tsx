import Link from 'next/link';

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M5 6h22c0 6.5-4.5 11-11 11S5 12.5 5 6Z"
        fill="var(--accent)"
        stroke="var(--ink)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M16 17v9M10 27h12" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="inline-flex min-h-12 items-center gap-2">
      <LogoMark />
      <span className="font-display text-lg font-semibold">Sipclock</span>
    </Link>
  );
}
