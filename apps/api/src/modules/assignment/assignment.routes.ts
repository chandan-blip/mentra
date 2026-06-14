import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireOnboardingComplete } from '../user-profile/index.js';
import { requirePermission } from '../access/access.middleware.js';
import { AiError } from '../../core/ai.js';
import { AssignmentError } from './assignment.errors.js';
import { getMe, getStatus, postSubmit } from './assignment.controller.js';

export const assignmentRouter: Router = Router();

assignmentRouter.use(requireAuth);
assignmentRouter.use(requireOnboardingComplete);
// Authorize per-module: role must be able to read `assignment` AND plan unlocks it.
assignmentRouter.use(requirePermission('assignment', 'read'));

// Generation is a single, cached AI call — cap how often a client can trigger it.
const submitLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 10,
  keyGenerator: (req: Request) => req.auth?.sub ?? req.ip ?? 'anon',
  standardHeaders: true,
  legacyHeaders: false,
});

assignmentRouter.get('/me/status', asyncHandler(getStatus));
assignmentRouter.get('/me', asyncHandler(getMe));
assignmentRouter.post('/me/submit', submitLimiter, asyncHandler(postSubmit));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }
      if (err instanceof AssignmentError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      if (err instanceof AiError) {
        res.status(502).json({ error: { code: 'AI_UNAVAILABLE', message: 'Could not generate the assignment right now' } });
        return;
      }
      req.log.error({ err }, 'assignment route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
