import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireFlag } from '../feature-flags/feature-flags.service.js';
import {
  ackHandler,
  getNextStepsHandler,
  getOverviewHandler,
  getStatsHandler,
} from './dashboard.controller.js';

export const dashboardRouter: Router = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.use(requireFlag('dashboard.enabled'));

const ackLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  keyGenerator: (req: Request) => req.auth?.sub ?? req.ip ?? 'anon',
  standardHeaders: true,
  legacyHeaders: false,
});

dashboardRouter.get('/overview', asyncHandler(getOverviewHandler));
dashboardRouter.get('/next-steps', asyncHandler(getNextStepsHandler));
dashboardRouter.post('/next-steps/:recId/ack', ackLimiter, asyncHandler(ackHandler));
dashboardRouter.get('/stats', asyncHandler(getStatsHandler));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }
      req.log.error({ err }, 'dashboard route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
