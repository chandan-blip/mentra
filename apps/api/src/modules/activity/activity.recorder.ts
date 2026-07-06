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
  on('roadmap.generated', ({ userId, roadmapId, source }) =>
    record(userId, 'roadmap.generated', { roadmapId, source }));
  on('roadmap.item.completed', ({ userId, roadmapId, itemId }) =>
    record(userId, 'roadmap.item.completed', { roadmapId, itemId }));
  on('assignment.generated', ({ userId, assignmentId }) =>
    record(userId, 'assignment.generated', { assignmentId }));
  on('assignment.completed', ({ userId, assignmentId, score }) =>
    record(userId, 'assignment.completed', { assignmentId, score }));
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
