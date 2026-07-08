import type { ReactNode } from 'react';

/**
 * Standard module page header: a boxed icon + title (+ optional subtitle / right-side
 * actions). Use this for every module title so the icon treatment stays consistent.
 */
export function PageHeader({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    // On mobile the title block is hidden (the app top bar already names the page),
    // leaving just the actions; at sm+ the icon + title show as the original row.
    // The negative bottom margin tightens the gap to the first section below the header
    // across every module in one place (pages space sections with space-y-6 = 24px; this
    // pulls the next block up ~8px regardless of whether the header is wrapped in a motion div).
    <div className="-mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="hidden min-w-0 flex-1 items-center gap-3 sm:flex sm:items-start sm:gap-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-inverse text-ink-inverse [&_svg]:size-5 sm:size-14 sm:[&_svg]:size-7">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-display-sm tracking-normal sm:text-display-md">{title}</h1>
          {/* Subtitle is hidden on phones to keep headers compact; shown at sm+. */}
          {subtitle ? <p className="mt-1 hidden text-sm leading-6 text-ink-muted sm:block">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="shrink-0 max-sm:w-full">{actions}</div> : null}
    </div>
  );
}
