import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../access/access.middleware.js';
import { LiveSessionError } from './live-session.errors.js';
import { MENTOR_MODULE, STUDENT_MODULE } from './live-session.service.js';
import {
  deleteLike,
  getById,
  getChatHistory,
  getLive,
  getMine,
  getPast,
  getSessionSummary,
  getUpcoming,
  getWatchProgress,
  patchSchedule,
  postCreate,
  postEnd,
  postFinalizeUpload,
  postJoinToken,
  postLike,
  postStart,
  postUpload,
  putWatchProgress,
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
// Mentor uploads a recorded video → presigned R2 PUT, then finalize → transcode.
liveSessionRouter.post('/sessions/upload', mentor, asyncHandler(postUpload));
liveSessionRouter.post('/sessions/:id/upload/finalize', mentor, asyncHandler(postFinalizeUpload));
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
// Like / unlike a session — auth only (any user who can open the watch page).
liveSessionRouter.post('/sessions/:id/like', asyncHandler(postLike));
liveSessionRouter.delete('/sessions/:id/like', asyncHandler(deleteLike));
// Single-session detail for the watch page. Registered AFTER the specific /sessions/<word>
// GETs (live/upcoming/past/mine) so those win; this matches any remaining id.
liveSessionRouter.get('/sessions/:id', asyncHandler(getById));

// Resume-watching — auth only; each user reads/writes their own recording position.
liveSessionRouter.get('/sessions/:id/progress', asyncHandler(getWatchProgress));
liveSessionRouter.put('/sessions/:id/progress', asyncHandler(putWatchProgress));

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
