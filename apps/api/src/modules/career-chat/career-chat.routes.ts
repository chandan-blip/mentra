import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../access/access.middleware.js';
import { CareerChatError } from './career-chat.errors.js';
import { CHAT_MODULE } from './career-chat.service.js';
import { getMessages, postEnroll, postMessage, postNudge } from './career-chat.controller.js';

export const careerChatRouter: Router = Router();

careerChatRouter.use(requireAuth);

const read = requirePermission(CHAT_MODULE, 'read');
const write = requirePermission(CHAT_MODULE, 'write');

/**
 * Per-user cap on the AI-backed turns (send + idle nudge). Each of these fires a chat
 * completion against the coach provider, whose free quota is finite and shared across
 * all students — without this a single authenticated account could loop the endpoint
 * and exhaust it for everyone. Keyed by user id (falls back to IP). Enroll/read don't
 * call the model, so they're not limited here.
 */
const coachLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 20,
  keyGenerator: (req: Request) => req.auth?.sub ?? req.ip ?? 'anon',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Slow down a moment — try again shortly.' } },
});

careerChatRouter.get('/messages', read, asyncHandler(getMessages));
careerChatRouter.post('/messages', write, coachLimiter, asyncHandler(postMessage));
careerChatRouter.post('/nudge', write, coachLimiter, asyncHandler(postNudge));
careerChatRouter.post('/enroll', write, asyncHandler(postEnroll));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }
      if (err instanceof CareerChatError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      req.log.error({ err }, 'career-chat route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
