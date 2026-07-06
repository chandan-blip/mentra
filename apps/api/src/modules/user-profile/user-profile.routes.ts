import { Router, type Request, type Response, raw } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../env.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireFlag } from '../feature-flags/feature-flags.service.js';
import {
  deleteAvatarHandler,
  deleteResumeHandler,
  getAvatarPublic,
  followHandler,
  getDirectoryHandler,
  getMe,
  getNotifications,
  getPublicProfileHandler,
  getResume,
  getSkillsCatalogue,
  unfollowHandler,
  patchMe,
  patchNotifications,
  postAvatar,
  postOnboardingStep,
  postResume,
} from './user-profile.controller.js';
import { ProfileError } from './user-profile.service.js';

/**
 * Public profile sub-routes (NO auth) — mounted at the same /api/v1/profile base
 * but BEFORE the authed router in app.ts. Avatars are served here so an <img> tag
 * (which can't send a bearer token) can load any user's picture.
 */
export const userProfilePublicRouter: Router = Router();
userProfilePublicRouter.get('/avatar/:userId', asyncHandler(getAvatarPublic));

export const userProfileRouter: Router = Router();

userProfileRouter.use(requireAuth);

const byUser = (req: Request) => req.auth?.sub ?? req.ip ?? 'anon';

const patchLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  keyGenerator: byUser,
  standardHeaders: true,
  legacyHeaders: false,
});

const resumeUploadLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  keyGenerator: byUser,
  standardHeaders: true,
  legacyHeaders: false,
});

const avatarUploadLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 20,
  keyGenerator: byUser,
  standardHeaders: true,
  legacyHeaders: false,
});

const RESUME_FLAG = 'profile.resume.upload';

userProfileRouter.get('/me', asyncHandler(getMe));
userProfileRouter.patch('/me', patchLimiter, asyncHandler(patchMe));
userProfileRouter.post('/me/onboarding/step', patchLimiter, asyncHandler(postOnboardingStep));

userProfileRouter.post(
  '/me/resume',
  requireFlag(RESUME_FLAG),
  resumeUploadLimiter,
  raw({ type: 'application/pdf', limit: env.RESUME_MAX_BYTES }),
  asyncHandler(postResume),
);
userProfileRouter.get('/me/resume', requireFlag(RESUME_FLAG), asyncHandler(getResume));
userProfileRouter.delete('/me/resume', requireFlag(RESUME_FLAG), asyncHandler(deleteResumeHandler));

userProfileRouter.post(
  '/me/avatar',
  avatarUploadLimiter,
  raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: env.AVATAR_MAX_BYTES }),
  asyncHandler(postAvatar),
);
userProfileRouter.delete('/me/avatar', asyncHandler(deleteAvatarHandler));

userProfileRouter.get('/me/notifications', asyncHandler(getNotifications));
userProfileRouter.patch('/me/notifications', patchLimiter, asyncHandler(patchNotifications));

userProfileRouter.get('/skills/catalogue', asyncHandler(getSkillsCatalogue));

// Student discovery directory. Registered before `/:userId` so the literal
// `/directory` segment isn't captured as a userId.
userProfileRouter.get('/directory', asyncHandler(getDirectoryHandler));

// Follow / unfollow another student (two-segment paths — no clash with `/:userId`).
userProfileRouter.post('/:userId/follow', patchLimiter, asyncHandler(followHandler));
userProfileRouter.delete('/:userId/follow', patchLimiter, asyncHandler(unfollowHandler));

// Public profile of another student. MUST stay last: its `/:userId` param would
// otherwise shadow the specific one-segment GET routes above (e.g. `/me`, `/directory`).
userProfileRouter.get('/:userId', asyncHandler(getPublicProfileHandler));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }
      if (err instanceof ProfileError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      req.log.error({ err }, 'profile route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
