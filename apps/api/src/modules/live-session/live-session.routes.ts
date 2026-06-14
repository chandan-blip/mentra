import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../access/access.middleware.js';
import { LiveSessionError } from './live-session.errors.js';
import { MENTOR_MODULE, STUDENT_MODULE } from './live-session.service.js';
import {
  getChatHistory,
  getLive,
  getMine,
  getPast,
  getSessionSummary,
  getUpcoming,
  patchSchedule,
  postCreate,
  postEnd,
  postJoinToken,
  postStart,
} from './live-session.controller.js';

export const liveSessionRouter: Router = Router();

liveSessionRouter.use(requireAuth);

// Mentor broadcast surface — role must grant write on the mentor module AND the
// mentor's plan must unlock it.
const mentor = requirePermission(MENTOR_MODULE, 'write');
// Student attend surface — read on the student module + plan unlock.
const student = requirePermission(STUDENT_MODULE, 'read');

liveSessionRouter.post('/sessions', mentor, asyncHandler(postCreate));
liveSessionRouter.get('/sessions/mine', mentor, asyncHandler(getMine));
liveSessionRouter.patch('/sessions/:id/schedule', mentor, asyncHandler(patchSchedule));
liveSessionRouter.post('/sessions/:id/start', mentor, asyncHandler(postStart));
liveSessionRouter.post('/sessions/:id/end', mentor, asyncHandler(postEnd));
liveSessionRouter.get('/sessions/:id/summary', mentor, asyncHandler(getSessionSummary));

liveSessionRouter.get('/sessions/live', student, asyncHandler(getLive));
liveSessionRouter.get('/sessions/upcoming', student, asyncHandler(getUpcoming));
liveSessionRouter.get('/sessions/past', student, asyncHandler(getPast));

// Shared by mentor (owner → publish) and students (→ subscribe). Access + grants
// are resolved in the service, so no single module gate fits here.
liveSessionRouter.get('/sessions/:id/messages', asyncHandler(getChatHistory));
liveSessionRouter.post('/sessions/:id/join-token', asyncHandler(postJoinToken));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }
      if (err instanceof LiveSessionError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      req.log.error({ err }, 'live-session route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
