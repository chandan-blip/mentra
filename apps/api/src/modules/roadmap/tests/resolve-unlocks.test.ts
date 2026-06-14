import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoadmapItemRow } from '../roadmap.repository.js';

// Mock the repository so the dep resolver can be exercised without a database.
vi.mock('../roadmap.repository.js', () => ({
  listItemsByRoadmap: vi.fn(),
  setItemsAvailable: vi.fn(),
}));

import { listItemsByRoadmap, setItemsAvailable } from '../roadmap.repository.js';
import { resolveUnlocks } from '../transitions/item-transition.service.js';

const listMock = vi.mocked(listItemsByRoadmap);
const setMock = vi.mocked(setItemsAvailable);

function item(
  id: string,
  status: RoadmapItemRow['status'],
  dependsOnIds: string[] = [],
): RoadmapItemRow {
  return {
    id,
    weekId: 'w',
    order: 0,
    type: 'topic',
    title: id,
    description: null,
    skillIds: [],
    estimatedMin: null,
    dependsOnIds,
    status,
    completedAt: null,
  };
}

describe('resolveUnlocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMock.mockResolvedValue(undefined);
  });

  it('unlocks a locked item once all its dependencies are done', async () => {
    listMock.mockResolvedValue([
      item('a', 'completed'),
      item('b', 'locked', ['a']),
    ]);

    const unlocked = await resolveUnlocks('rm');

    expect(unlocked).toEqual(['b']);
    expect(setMock).toHaveBeenCalledWith(['b']);
  });

  it('leaves an item locked while any dependency is unfinished', async () => {
    listMock.mockResolvedValue([
      item('a', 'completed'),
      item('d', 'in_progress'),
      item('c', 'locked', ['a', 'd']),
    ]);

    const unlocked = await resolveUnlocks('rm');

    expect(unlocked).toEqual([]);
    expect(setMock).toHaveBeenCalledWith([]);
  });

  it('treats a skipped dependency as satisfied', async () => {
    listMock.mockResolvedValue([
      item('a', 'skipped'),
      item('b', 'locked', ['a']),
    ]);

    expect(await resolveUnlocks('rm')).toEqual(['b']);
  });

  it('never unlocks an item that has no dependencies', async () => {
    // Week-1 items start `available`; a locked item with empty deps is a generator
    // bug and must stay locked rather than silently unlock.
    listMock.mockResolvedValue([item('e', 'locked', [])]);

    expect(await resolveUnlocks('rm')).toEqual([]);
  });

  it('unlocks multiple items in one pass', async () => {
    listMock.mockResolvedValue([
      item('a', 'completed'),
      item('b', 'locked', ['a']),
      item('c', 'locked', ['a']),
      item('d', 'locked', ['b']), // still blocked — b not done yet
    ]);

    const unlocked = await resolveUnlocks('rm');

    expect(unlocked.sort()).toEqual(['b', 'c']);
  });
});
