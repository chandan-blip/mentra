import { on } from '../../core/events.js';
import { logger } from '../../logger.js';
import { getProfileMe } from './user-profile.service.js';

/**
 * Wire this module's event listeners. Called once at boot.
 * - user.verified  → auto-create empty profile + default notification prefs.
 * - user.deleted   → profile/prefs rows cascade via FK; resume objects are
 *   left to a future prefix-cleanup job (no key available post-delete).
 */
export function registerUserProfileListeners(): void {
  on('user.verified', async ({ userId }) => {
    await getProfileMe(userId);
    logger.info({ userId }, 'profile auto-created from user.verified');
  });

  on('user.deleted', ({ userId }) => {
    logger.info({ userId }, 'user.deleted received; profile cascade handled by FK');
  });
}
