import { on } from '../../core/events.js';
import { logger } from '../../logger.js';
import { isEnabled } from '../feature-flags/feature-flags.service.js';
import { autoRegenerate, generateForUser } from './roadmap.service.js';

const IMPACTFUL_FIELDS = new Set(['goal', 'targetRoles', 'studyHoursPerDay', 'techStack']);

/**
 * Roadmap listeners:
 *  - assignment.completed → generate the student's roadmap from their completed
 *    AI assignment + closing answers (replaces the old assessment-driven trigger).
 *  - student-profile.updated (impactful fields) → throttled auto-regeneration.
 */
export function registerRoadmapListeners(): void {
  on('assignment.completed', async ({ userId, assignmentId }) => {
    if (!(await isEnabled('roadmap.enabled'))) return;
    await generateForUser(userId, 'assignment.completed', null);
    logger.info({ userId, assignmentId }, 'roadmap generated from assignment.completed');
  });

  on('student-profile.updated', async ({ userId, changedFields }) => {
    if (!(await isEnabled('roadmap.enabled'))) return;
    if (!(await isEnabled('roadmap.auto_regenerate.on_profile_change'))) return;
    if (!changedFields.some((f) => IMPACTFUL_FIELDS.has(f))) return;
    const ran = await autoRegenerate(userId, 'profile.updated');
    if (ran) logger.info({ userId, changedFields }, 'roadmap auto-regenerated from profile update');
  });
}
