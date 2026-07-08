import { motion } from 'framer-motion';

export type WeekProgress = { weekNumber: number; completed: number; total: number };

/**
 * Per-week roadmap completion as a small vertical bar chart. Single series (completion), so one
 * hue: bar *height* encodes the week's workload (items, scaled to the busiest week) and the green
 * *fill* encodes how much of that week is done. The current week is ringed + labelled so identity
 * isn't carried by color alone. Div-based marks (no chart lib), with a native hover tooltip.
 */
export function WeeklyProgressChart({
  weeks,
  currentWeek,
  height = 132,
}: {
  weeks: WeekProgress[];
  currentWeek: number;
  height?: number;
}) {
  if (weeks.length === 0) return null;
  const maxTotal = Math.max(1, ...weeks.map((w) => w.total));
  // Label every week when there's room, else thin to keep the axis readable.
  const labelEvery = weeks.length > 16 ? 4 : weeks.length > 10 ? 2 : 1;

  return (
    <div className="flex items-end gap-1.5" style={{ height: height + 20 }}>
      {weeks.map((w) => {
        const trackH = Math.max(6, (w.total / maxTotal) * height);
        const ratio = w.total > 0 ? w.completed / w.total : 0;
        const isCurrent = w.weekNumber === currentWeek;
        const done = w.total > 0 && w.completed === w.total;
        return (
          <div key={w.weekNumber} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div
              title={`Week ${w.weekNumber}: ${w.completed}/${w.total} done`}
              className={`flex w-full max-w-[26px] items-end overflow-hidden rounded-md bg-surface-sunken ${
                isCurrent ? 'ring-1 ring-accent-blue' : 'ring-1 ring-border-subtle'
              }`}
              style={{ height: trackH }}
            >
              <motion.div
                className={`w-full rounded-md ${done ? 'bg-accent-green' : 'bg-accent-green/70'}`}
                initial={{ height: 0 }}
                animate={{ height: `${ratio * 100}%` }}
                transition={{ type: 'spring', stiffness: 140, damping: 22 }}
              />
            </div>
            <span
              className={`text-[10px] tabular-nums ${isCurrent ? 'font-semibold text-accent-blue' : 'text-ink-faint'}`}
            >
              {w.weekNumber % labelEvery === 0 || isCurrent || w.weekNumber === 1 ? w.weekNumber : ' '}
            </span>
          </div>
        );
      })}
    </div>
  );
}
