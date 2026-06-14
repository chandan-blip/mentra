import type { NextFunction, Request, Response } from 'express';
import { isEnabled } from '../feature-flags/feature-flags.service.js';
import { ensureProfile } from './user-profile.service.js';

/**
 * Gates routes that need a finished profile (assessment, roadmap). When the
 * `profile.onboarding.required` flag is off, the gate is a no-op.
 */
export function requireOnboardingComplete(req: Request, res: Response, next: NextFunction): void {
  const userId = req.auth?.sub;
  if (!userId) {
    res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    return;
  }

  (async () => {
    if (!(await isEnabled('profile.onboarding.required'))) return next();
    const profile = await ensureProfile(userId);
    const complete = profile.onboardingComplete === true || profile.onboardingComplete === 1;
    if (complete) return next();
    res.status(403).json({
      error: { code: 'ONBOARDING_INCOMPLETE', message: 'Complete onboarding to continue' },
    });
  })().catch((err: unknown) => {
    req.log.error({ err }, 'onboarding gate failed');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
  });
}
