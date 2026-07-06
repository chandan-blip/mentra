import type { ActivityHeatCell } from '@mentra/shared';

/**
 * GitHub-style contribution grid for the last ~12 weeks. The API only returns days
 * that had activity, so gaps are filled client-side into a continuous 84-day grid.
 */
export function ActivityHeatmap({ activeDays, weeks = 12 }: { activeDays: ActivityHeatCell[]; weeks?: number }) {
  const days = weeks * 7;
  const counts = new Map(activeDays.map((d) => [d.day, d.count]));
  const cells: { key: string; count: number }[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - (days - 1));
  for (let i = 0; i < days; i += 1) {
    const key = cursor.toLocaleDateString('en-CA');
    cells.push({ key, count: counts.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return (
    <div className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto">
      {cells.map((c) => (
        <span
          key={c.key}
          title={`${c.key}: ${c.count} ${c.count === 1 ? 'activity' : 'activities'}`}
          className={`size-3 rounded-sm ${shade(c.count)}`}
        />
      ))}
    </div>
  );
}

function shade(c: number): string {
  if (c <= 0) return 'bg-surface-sunken';
  if (c === 1) return 'bg-accent-green/30';
  if (c <= 3) return 'bg-accent-green/60';
  return 'bg-accent-green';
}
