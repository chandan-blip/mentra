import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireOnboardingComplete } from '../user-profile/index.js';
import { requireFlag } from '../feature-flags/feature-flags.service.js';
import { requirePermission } from '../access/access.middleware.js';
import { RoadmapError } from './roadmap.errors.js';
import {
  getHistoryHandler,
  getHistoryRoadmapHandler,
  getMe,
  getResultsHandler,
  getSubtopicsHandler,
  getSummaryHandler,
  getTestHandler,
  getTopicHandler,
  getWeekHandler,
  postComplete,
  postRegenerate,
  postStart,
  postStartTest,
  postSubmitTest,
} from './roadmap.controller.js';

export const roadmapRouter: Router = Router();

roadmapRouter.use(requireAuth);
roadmapRouter.use(requireFlag('roadmap.enabled'));
roadmapRouter.use(requireOnboardingComplete);
// Authorize per-module: the user's role must be able to read `roadmap` AND their
// plan must unlock it. Admins pass implicitly.
roadmapRouter.use(requirePermission('roadmap', 'read'));

const regenerateLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  keyGenerator: (req: Request) => req.auth?.sub ?? req.ip ?? 'anon',
  standardHeaders: true,
  legacyHeaders: false,
});

roadmapRouter.get('/me', asyncHandler(getMe));
roadmapRouter.get('/me/summary', asyncHandler(getSummaryHandler));
roadmapRouter.get('/me/week/:n', asyncHandler(getWeekHandler));
roadmapRouter.post('/me/regenerate', regenerateLimiter, asyncHandler(postRegenerate));
roadmapRouter.get('/me/history', asyncHandler(getHistoryHandler));
roadmapRouter.get('/me/history/:roadmapId', asyncHandler(getHistoryRoadmapHandler));
roadmapRouter.post('/items/:id/start', asyncHandler(postStart));
roadmapRouter.post('/items/:id/complete', asyncHandler(postComplete));

// Topic subtopics + completion test. Subtopics and test questions are AI-generated
// on demand (and cached) the first time the relevant endpoint is hit.
roadmapRouter.get('/items/:id/topic', asyncHandler(getTopicHandler));
roadmapRouter.get('/items/:id/subtopics', asyncHandler(getSubtopicsHandler));
roadmapRouter.post('/items/:id/test', asyncHandler(postStartTest));
roadmapRouter.get('/items/:id/results', asyncHandler(getResultsHandler));
roadmapRouter.get('/tests/:testId', asyncHandler(getTestHandler));
roadmapRouter.post('/tests/:testId/submit', asyncHandler(postSubmitTest));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }
      if (err instanceof RoadmapError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      req.log.error({ err }, 'roadmap route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
