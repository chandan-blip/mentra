import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../access/access.middleware.js';
import { LearningError } from './learning.errors.js';
import {
  getCategories,
  getCategoryById,
  getLearningProgress,
  getTestById,
  getTopicSearch,
  postCustomQuiz,
  postStartTest,
  postSubmitTest,
} from './learning.controller.js';

export const learningRouter: Router = Router();

// Auth + student module gate. Categories derive from the student's profile; any student
// with learning access can take any test.
learningRouter.use(requireAuth);
learningRouter.use(requirePermission('learning', 'read'));

learningRouter.get('/categories', asyncHandler(getCategories));
learningRouter.get('/categories/:id', asyncHandler(getCategoryById));
learningRouter.get('/progress', asyncHandler(getLearningProgress));
learningRouter.get('/search', asyncHandler(getTopicSearch));
learningRouter.post('/custom', asyncHandler(postCustomQuiz));
learningRouter.get('/tests/:id', asyncHandler(getTestById));
learningRouter.post('/tests/:id/start', asyncHandler(postStartTest));
learningRouter.post('/tests/:id/submit', asyncHandler(postSubmitTest));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }
      if (err instanceof LearningError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      req.log.error({ err }, 'learning route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
