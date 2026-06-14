import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the handlers the module registers with the event bus so we can fire them.
const { handlers } = vi.hoisted(() => ({
  handlers: {} as Record<string, (payload: unknown) => Promise<void>>,
}));

vi.mock('../../../core/events.js', () => ({
  on: (event: string, h: (payload: unknown) => Promise<void>) => {
    handlers[event] = h;
  },
  emit: vi.fn(),
}));
vi.mock('../../feature-flags/feature-flags.service.js', () => ({ isEnabled: vi.fn() }));
vi.mock('../roadmap.service.js', () => ({ generateForUser: vi.fn(), autoRegenerate: vi.fn() }));

import { isEnabled } from '../../feature-flags/feature-flags.service.js';
import { autoRegenerate, generateForUser } from '../roadmap.service.js';
import { registerRoadmapListeners } from '../events.js';

const flags = vi.mocked(isEnabled);
const allFlagsOn = () => flags.mockResolvedValue(true);

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(handlers)) delete handlers[k];
  registerRoadmapListeners();
});

describe('assignment.completed listener', () => {
  it('generates a roadmap from the completed assignment', async () => {
    allFlagsOn();
    await handlers['assignment.completed']!({ userId: 'u1', assignmentId: 'asg-1', score: 80 });
    expect(generateForUser).toHaveBeenCalledWith('u1', 'assignment.completed', null);
  });

  it('does nothing when the roadmap module is disabled', async () => {
    flags.mockResolvedValue(false);
    await handlers['assignment.completed']!({ userId: 'u1', assignmentId: 'asg-1', score: 80 });
    expect(generateForUser).not.toHaveBeenCalled();
  });
});

describe('student-profile.updated listener', () => {
  it('auto-regenerates when an impactful field changes', async () => {
    allFlagsOn();
    await handlers['student-profile.updated']!({ userId: 'u1', changedFields: ['goal'] });
    expect(autoRegenerate).toHaveBeenCalledWith('u1', 'profile.updated');
  });

  it('ignores changes to non-impactful fields', async () => {
    allFlagsOn();
    await handlers['student-profile.updated']!({ userId: 'u1', changedFields: ['displayName', 'avatarUrl'] });
    expect(autoRegenerate).not.toHaveBeenCalled();
  });

  it('respects the auto-regenerate flag', async () => {
    flags.mockImplementation(async (key: string) => key !== 'roadmap.auto_regenerate.on_profile_change');
    await handlers['student-profile.updated']!({ userId: 'u1', changedFields: ['studyHoursPerDay'] });
    expect(autoRegenerate).not.toHaveBeenCalled();
  });
});
