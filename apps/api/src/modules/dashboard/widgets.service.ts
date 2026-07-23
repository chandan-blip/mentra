import type { DashboardWidgets } from '@mentra/shared';
import { isEnabled } from '../feature-flags/feature-flags.service.js';

// Later modules flip their flag on during rollout; until then the card shows locked.
const WIDGETS: { key: string; flag: string; lockReason: string }[] = [
  { key: 'dailyTasks', flag: 'dashboard.widget.dailyTasks', lockReason: 'ships_phase_2' },
  { key: 'liveSessions', flag: 'dashboard.widget.liveSessions', lockReason: 'ships_phase_3' },
];

export async function buildWidgets(): Promise<DashboardWidgets> {
  const entries = await Promise.all(
    WIDGETS.map(async (w) => {
      const enabled = await isEnabled(w.flag);
      return [w.key, enabled ? { enabled: true } : { enabled: false, lockReason: w.lockReason }] as const;
    }),
  );
  return Object.fromEntries(entries);
}
