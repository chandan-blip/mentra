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
    // On mobile the actions wrap below the title (so a CTA can't crush it); the icon
    // + title stay together and are a touch smaller. At sm+ it's the original row.
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-surface-inverse text-ink-inverse [&_svg]:size-6 sm:size-14 sm:[&_svg]:size-7">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-display-sm tracking-normal sm:text-display-md">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm leading-6 text-ink-muted">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="shrink-0 max-sm:w-full">{actions}</div> : null}
    </div>
  );
}
