import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { getMine, getMyFocus, getMySummary, getUserSummary, postEvents } from './activity.controller.js';

export const activityRouter: Router = Router();

activityRouter.use(requireAuth);

const byUser = (req: Request) => req.auth?.sub ?? req.ip ?? 'anon';

// Ingestion can be chatty (page views, mobile batches) — allow a generous burst.
const ingestLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  keyGenerator: byUser,
  standardHeaders: true,
  legacyHeaders: false,
});

activityRouter.post('/events', ingestLimiter, asyncHandler(postEvents));
activityRouter.get('/me', asyncHandler(getMine));
activityRouter.get('/me/summary', asyncHandler(getMySummary));
activityRouter.get('/me/focus', asyncHandler(getMyFocus));

// Curated public summary for another student's profile. Registered after the
// specific `/me*` routes so `:userId` can't capture the literal `me`.
activityRouter.get('/:userId/summary', asyncHandler(getUserSummary));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }
      req.log.error({ err }, 'activity route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
