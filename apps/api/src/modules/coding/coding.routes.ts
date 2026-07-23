import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../access/access.middleware.js';
import { CodingError } from './coding.errors.js';
import {
  deleteTaskById,
  getAdminTasks,
  getProgressSummary,
  getTaskDetail,
  getTaskSubmissions,
  getTasks,
  patchTask,
  postSubmit,
  postTask,
} from './coding.controller.js';

/**
 * Student-facing coding module (`/api/v1/coding`, module key `coding`): browse the task
 * list, open a task, and submit a solution that's graded in the sandbox.
 */
export const codingRouter: Router = Router();
codingRouter.use(requireAuth);
codingRouter.use(requirePermission('coding', 'read'));

codingRouter.get('/tasks', asyncHandler(getTasks));
codingRouter.get('/progress', asyncHandler(getProgressSummary));
codingRouter.get('/tasks/:id', asyncHandler(getTaskDetail));
codingRouter.post('/tasks/:taskId/questions/:questionId/submit', asyncHandler(postSubmit));

/**
 * Manager-facing authoring surface (`/api/v1/coding-tasks`, module key `coding-tasks`):
 * create/edit/delete tasks and review student submissions. Gated on write access to the
 * `coding-tasks` module (admins bypass).
 */
export const codingTasksRouter: Router = Router();
codingTasksRouter.use(requireAuth);
codingTasksRouter.use(requirePermission('coding-tasks', 'write'));

codingTasksRouter.get('/', asyncHandler(getAdminTasks));
codingTasksRouter.post('/', asyncHandler(postTask));
codingTasksRouter.patch('/:id', asyncHandler(patchTask));
codingTasksRouter.delete('/:id', asyncHandler(deleteTaskById));
codingTasksRouter.get('/:id/submissions', asyncHandler(getTaskSubmissions));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }
      if (err instanceof CodingError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      req.log.error({ err }, 'coding route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
