import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { CommunityError } from './community.errors.js';
import {
  deleteCommentHandler,
  deletePostHandler,
  getComments,
  getMembers,
  getPosts,
  patchComment,
  patchPost,
  postComment,
  postPin,
  postPost,
} from './community.controller.js';

export const communityRouter: Router = Router();

// Shared by every role — auth only, no module/plan gate. Moderation is resolved per
// action in the service (author or admin).
communityRouter.use(requireAuth);

communityRouter.get('/posts', asyncHandler(getPosts));
communityRouter.post('/posts', asyncHandler(postPost));
communityRouter.patch('/posts/:id', asyncHandler(patchPost));
communityRouter.delete('/posts/:id', asyncHandler(deletePostHandler));
communityRouter.post('/posts/:id/pin', asyncHandler(postPin));
communityRouter.get('/posts/:id/comments', asyncHandler(getComments));
communityRouter.post('/posts/:id/comments', asyncHandler(postComment));
communityRouter.patch('/comments/:id', asyncHandler(patchComment));
communityRouter.delete('/comments/:id', asyncHandler(deleteCommentHandler));
communityRouter.get('/members', asyncHandler(getMembers));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }
      if (err instanceof CommunityError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      req.log.error({ err }, 'community route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
