export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-5 py-8 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <p>Excessive alcohol consumption is harmful to your health.</p>
        <span className="inline-flex w-fit items-center rounded-pill border border-line px-3 py-1 font-semibold text-ink">
          18+
        </span>
      </div>
    </footer>
  );
}
