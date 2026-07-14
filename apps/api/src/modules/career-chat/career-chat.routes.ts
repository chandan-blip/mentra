import { Router, type Request, type Response } from 'express';
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

careerChatRouter.get('/messages', read, asyncHandler(getMessages));
careerChatRouter.post('/messages', write, asyncHandler(postMessage));
careerChatRouter.post('/nudge', write, asyncHandler(postNudge));
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
