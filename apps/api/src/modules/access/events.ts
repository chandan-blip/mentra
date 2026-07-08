import { on } from '../../core/events.js';
import { logger } from '../../logger.js';
import { assignPlanIfUnset, getDefaultPlanId } from './access.repository.js';

/**
 * Wire this module's event listeners. Called once at boot.
 * - user.verified → assign the current default plan (isDefault=true) to the new user.
 *   No-op when no default is configured; access resolution still falls back to the
 *   default at read time, but assigning here makes the plan explicit on User.planId.
 */
export function registerAccessListeners(): void {
  on('user.verified', async ({ userId }) => {
    const planId = await getDefaultPlanId();
    if (!planId) return;
    await assignPlanIfUnset(userId, planId);
    logger.info({ userId, planId }, 'assigned default plan from user.verified');
  });
}
