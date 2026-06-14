import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemWithContext, RoadmapItemRow, RoadmapRow, RoadmapWeekRow } from '../roadmap.repository.js';

// The repository is the DB boundary — mock it so the service's orchestration logic
// (guards, transitions, archiving, events) can be tested without a database.
vi.mock('../roadmap.repository.js', () => ({
  createRoadmapFromPlan: vi.fn(),
  findActiveRoadmap: vi.fn(),
  findItemWithContext: vi.fn(),
  findRoadmapById: vi.fn(),
  listItemsByRoadmap: vi.fn(),
  listRoadmapsByUser: vi.fn(),
  listWeeks: vi.fn(),
  updateItemStatus: vi.fn(),
  setItemsAvailable: vi.fn(),
}));
vi.mock('../../user-profile/index.js', () => ({ getProfile: vi.fn() }));
vi.mock('../../assignment/index.js', () => ({ getAssignmentResultForUser: vi.fn() }));
vi.mock('../../../core/events.js', () => ({ emit: vi.fn(), on: vi.fn() }));
vi.mock('../../../core/redis.js', () => ({ redis: { set: vi.fn() } }));

import * as repo from '../roadmap.repository.js';
import { getProfile } from '../../user-profile/index.js';
import { getAssignmentResultForUser } from '../../assignment/index.js';
import { emit } from '../../../core/events.js';
import { redis } from '../../../core/redis.js';
import { autoRegenerate, itemAction, regenerate } from '../roadmap.service.js';

const m = <T extends (...args: never[]) => unknown>(fn: T) => vi.mocked(fn);

function itemRow(over: Partial<RoadmapItemRow> = {}): RoadmapItemRow {
  return {
    id: 'item-1',
    weekId: 'wk-1',
    order: 0,
    // Default to a non-topic type: topics complete only via their test, so the
    // generic complete-action tests below use a type the guard allows.
    type: 'practice',
    title: 'Item',
    description: null,
    skillIds: [],
    estimatedMin: null,
    dependsOnIds: [],
    status: 'available',
    completedAt: null,
    ...over,
  };
}

function ctx(over: Partial<ItemWithContext> = {}): ItemWithContext {
  return { ...itemRow(), roadmapId: 'rm-1', userId: 'u1', roadmapStatus: 'active', ...over };
}

const roadmapRow: RoadmapRow = {
  id: 'rm-1',
  userId: 'u1',
  status: 'active',
  generatedBy: 'default-v1',
  basisAttemptId: null,
  totalWeeks: 1,
  startedOn: new Date('2026-01-01'),
  archivedAt: null,
  notes: null,
};

const weekRow: RoadmapWeekRow = { id: 'wk-1', roadmapId: 'rm-1', weekNumber: 1, title: 'Week 1', theme: null };

beforeEach(() => {
  vi.clearAllMocks();
  m(repo.setItemsAvailable).mockResolvedValue(undefined);
  m(repo.updateItemStatus).mockResolvedValue(undefined);
  m(getProfile).mockResolvedValue({
    goal: 'backend',
    targetRoles: ['backend'],
    techStack: ['node'],
    studyHoursPerDay: 2,
  } as never);
  m(getAssignmentResultForUser).mockResolvedValue(null);
});

describe('itemAction guards', () => {
  it('rejects an unknown item', async () => {
    m(repo.findItemWithContext).mockResolvedValue(null);
    await expect(itemAction('u1', 'missing', 'complete')).rejects.toMatchObject({ code: 'ITEM_NOT_FOUND' });
  });

  it("rejects another user's item", async () => {
    m(repo.findItemWithContext).mockResolvedValue(ctx({ userId: 'someone-else' }));
    await expect(itemAction('u1', 'item-1', 'complete')).rejects.toMatchObject({ code: 'ITEM_NOT_FOUND' });
  });

  it('cannot write to an archived roadmap', async () => {
    m(repo.findItemWithContext).mockResolvedValue(ctx({ roadmapStatus: 'archived' }));
    await expect(itemAction('u1', 'item-1', 'complete')).rejects.toMatchObject({
      code: 'ROADMAP_NOT_ACTIVE',
      status: 409,
    });
    expect(repo.updateItemStatus).not.toHaveBeenCalled();
  });

  it('cannot complete a locked item', async () => {
    m(repo.findItemWithContext).mockResolvedValue(ctx({ status: 'locked' }));
    await expect(itemAction('u1', 'item-1', 'complete')).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
      status: 409,
    });
    expect(repo.updateItemStatus).not.toHaveBeenCalled();
  });

  it('cannot complete a topic via the generic action — it requires passing the test', async () => {
    m(repo.findItemWithContext).mockResolvedValue(ctx({ type: 'topic', status: 'in_progress' }));
    await expect(itemAction('u1', 'item-1', 'complete')).rejects.toMatchObject({
      code: 'TOPIC_REQUIRES_TEST',
      status: 409,
    });
    expect(repo.updateItemStatus).not.toHaveBeenCalled();
  });

  it('still lets a topic be started (start is not the completion path)', async () => {
    m(repo.findItemWithContext).mockResolvedValue(ctx({ type: 'topic', status: 'available' }));
    const result = await itemAction('u1', 'item-1', 'start');
    expect(result.status).toBe('in_progress');
  });
});

describe('itemAction completion', () => {
  it('completes an item, unlocks dependents, and emits an event', async () => {
    m(repo.findItemWithContext).mockResolvedValue(ctx({ status: 'in_progress' }));
    m(repo.listItemsByRoadmap).mockResolvedValue([
      itemRow({ id: 'item-1', status: 'completed' }),
      itemRow({ id: 'item-2', status: 'locked', dependsOnIds: ['item-1'] }),
    ]);

    const result = await itemAction('u1', 'item-1', 'complete');

    expect(result.status).toBe('completed');
    expect(result.unlocked).toEqual(['item-2']);
    expect(repo.updateItemStatus).toHaveBeenCalledWith('item-1', 'completed', expect.any(Date));
    expect(emit).toHaveBeenCalledWith(
      'roadmap.item.completed',
      expect.objectContaining({ userId: 'u1', itemId: 'item-1' }),
    );
  });
});

describe('regenerate', () => {
  it('generates a plan, persists it, and returns the active view', async () => {
    m(repo.createRoadmapFromPlan).mockResolvedValue('rm-new');
    m(repo.findActiveRoadmap).mockResolvedValue(roadmapRow);
    m(repo.listWeeks).mockResolvedValue([weekRow]);
    m(repo.listItemsByRoadmap).mockResolvedValue([
      itemRow({ id: 'a', status: 'completed' }),
      itemRow({ id: 'b', status: 'available' }),
    ]);

    const view = await regenerate('u1', 'manual test');

    expect(repo.createRoadmapFromPlan).toHaveBeenCalledTimes(1);
    expect(view.totalItems).toBe(2);
    expect(view.completedItems).toBe(1);
    expect(view.percentComplete).toBe(50);
    expect(emit).toHaveBeenCalledWith('roadmap.generated', expect.objectContaining({ userId: 'u1' }));
  });
});

describe('autoRegenerate throttle', () => {
  it('runs when the Redis lock is acquired', async () => {
    m(redis.set).mockResolvedValue('OK' as never);
    m(repo.createRoadmapFromPlan).mockResolvedValue('rm-new');

    expect(await autoRegenerate('u1', 'profile.updated')).toBe(true);
    expect(repo.createRoadmapFromPlan).toHaveBeenCalledTimes(1);
    // Lock is set with NX so concurrent triggers can't double-generate.
    expect(redis.set).toHaveBeenCalledWith(
      'roadmap:autoregen:u1',
      '1',
      'EX',
      expect.any(Number),
      'NX',
    );
  });

  it('skips when the throttle lock is already held', async () => {
    m(redis.set).mockResolvedValue(null as never);

    expect(await autoRegenerate('u1', 'profile.updated')).toBe(false);
    expect(repo.createRoadmapFromPlan).not.toHaveBeenCalled();
  });
});
