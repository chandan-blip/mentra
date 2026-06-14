import { on } from '../../core/events.js';
import { logger } from '../../logger.js';

/**
 * Live-session domain listeners. Currently just observability — the seam exists so
 * other modules (notifications, analytics, recording/egress) can react to a session
 * going live or ending without coupling to this module.
 */
export function registerLiveSessionListeners(): void {
  on('live-session.started', ({ sessionId, mentorId }) => {
    logger.info({ sessionId, mentorId }, 'live session started');
  });
  on('live-session.ended', ({ sessionId, mentorId }) => {
    logger.info({ sessionId, mentorId }, 'live session ended');
  });
}
