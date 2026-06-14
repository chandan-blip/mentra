import type { RoadmapItemRow } from '../roadmap.repository.js';
import { listItemsByRoadmap, setItemsAvailable } from '../roadmap.repository.js';
import { RoadmapError } from '../roadmap.errors.js';

type Status = RoadmapItemRow['status'];
export type ItemAction = 'start' | 'complete';

/** Validate + compute the next status for an item action (status machine). */
export function nextStatusFor(action: ItemAction, current: Status): Status {
  switch (action) {
    case 'start':
      if (current !== 'available') {
        throw new RoadmapError('INVALID_TRANSITION', `Cannot start an item that is ${current}`, 409);
      }
      return 'in_progress';
    case 'complete':
      if (current !== 'available' && current !== 'in_progress') {
        throw new RoadmapError('INVALID_TRANSITION', `Cannot complete an item that is ${current}`, 409);
      }
      return 'completed';
  }
}

// Skipping is no longer offered, but legacy rows may still be 'skipped' — treat
// that as done so any dependents stay unlocked.
const isDone = (s: Status) => s === 'completed' || s === 'skipped';

/**
 * After an item reaches a terminal state, unlock any locked items whose
 * dependencies are now all satisfied. Returns the newly-available item ids.
 */
export async function resolveUnlocks(roadmapId: string): Promise<string[]> {
  const items = await listItemsByRoadmap(roadmapId);
  const doneIds = new Set(items.filter((i) => isDone(i.status)).map((i) => i.id));

  const toUnlock = items
    .filter((i) => {
      if (i.status !== 'locked') return false;
      const deps = i.dependsOnIds ?? [];
      return deps.length > 0 && deps.every((d) => doneIds.has(d));
    })
    .map((i) => i.id);

  await setItemsAvailable(toUnlock);
  return toUnlock;
}
