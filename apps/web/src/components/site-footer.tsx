import { getUi, type Locale } from '@/i18n/ui';

export function SiteFooter({ locale }: { locale: Locale }) {
  const ui = getUi(locale);
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-5 py-8 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <p>{ui.footer.warning}</p>
        <span className="inline-flex w-fit items-center rounded-pill border border-line px-3 py-1 font-semibold text-ink">
          {ui.footer.adult}
        </span>
      </div>
    </footer>
  );
}
