import { on } from '../../core/events.js';
import { logger } from '../../logger.js';
import { ensureAssignmentForUser } from './assignment.service.js';

/**
 * Assignment listeners:
 *  - student-profile.onboarding-completed → generate the student's personalized
 *    assignment (one cached AI call; a no-op if one already exists).
 */
export function registerAssignmentListeners(): void {
  on('student-profile.onboarding-completed', async ({ userId }) => {
    try {
      await ensureAssignmentForUser(userId);
      logger.info({ userId }, 'assignment generated from onboarding-completed');
    } catch (err) {
      logger.error({ err, userId }, 'assignment generation on onboarding failed');
    }
  });
}
