import { on } from '../../core/events.js';
import { logger } from '../../logger.js';
import { insertEvents } from './activity.repository.js';

/**
 * Bridges the in-process domain event bus into the activity log: every meaningful
 * learning event already emitted elsewhere is persisted as a server-sourced
 * ActivityEvent — no changes needed in the emitting modules. Client-only signals
 * (page views, focus blocks, future mobile app-usage) arrive separately via the
 * ingestion endpoint.
 */
let registered = false;

export function registerActivityRecorder(): void {
  if (registered) return; // createApp may run more than once in tests
  registered = true;

  on('student-profile.onboarding-completed', ({ userId }) => record(userId, 'onboarding.completed'));
  on('learning.test.completed', ({ userId, categoryId, testId, percent, passed }) =>
    record(userId, 'learning.test.completed', { categoryId, testId, percent, passed }));
  on('learning.series.completed', ({ userId, categoryId }) =>
    record(userId, 'learning.series.completed', { categoryId }));
  on('live-session.started', ({ sessionId, mentorId }) =>
    record(mentorId, 'live-session.started', { sessionId }));
  on('live-session.ended', ({ sessionId, mentorId }) =>
    record(mentorId, 'live-session.ended', { sessionId }));

  logger.info('activity.recorder registered');
}

function record(userId: string, type: string, metadata?: Record<string, unknown>): Promise<void> {
  return insertEvents([{ userId, type, source: 'server', metadata: metadata ?? null }]).catch(
    (err: unknown) => {
      // Never let activity logging break the primary flow — the event bus already
      // isolates handlers, but be defensive.
      logger.error({ err, type, userId }, 'activity.record failed');
    },
  );
}
