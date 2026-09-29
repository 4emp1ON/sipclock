/** Placeholder illustration until real drink photography lands. */
export function GlassIllustration({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 240" fill="none" aria-hidden="true" className={className}>
      <path
        d="M60 40h80l-8 150a12 12 0 0 1-12 11h-40a12 12 0 0 1-12-11L60 40Z"
        fill="var(--surface)"
        stroke="var(--ink-muted)"
        strokeWidth="3"
      />
      <path
        d="M64 88h72l-4 102a8 8 0 0 1-8 8h-48a8 8 0 0 1-8-8L64 88Z"
        fill="var(--primary)"
        opacity=".55"
      />
      <path d="M118 30l26-16" stroke="var(--mint)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="100" cy="120" r="7" fill="var(--ink)" opacity=".35" />
      <circle cx="115" cy="150" r="5" fill="var(--ink)" opacity=".35" />
    </svg>
  );
}
