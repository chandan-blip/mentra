import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/roadmap', label: 'This week', end: true },
  { to: '/roadmap/all', label: 'All weeks', end: false },
  { to: '/roadmap/history', label: 'History', end: false },
];

/** Secondary nav shared across the roadmap section's pages. */
export function RoadmapTabs() {
  return (
    <div className="mt-4 flex gap-1 border-b border-border-subtle">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            [
              '-mb-px border-b-2 px-3 pb-2 text-sm transition',
              isActive
                ? 'border-ink font-medium text-ink'
                : 'border-transparent text-ink-muted hover:text-ink',
            ].join(' ')
          }
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
