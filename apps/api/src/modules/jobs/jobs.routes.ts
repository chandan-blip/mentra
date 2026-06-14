import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../access/access.middleware.js';
import { JobError } from './jobs.errors.js';
import { HR_MODULE, STUDENT_MODULE } from './jobs.service.js';
import {
  deleteJobHandler,
  getHrJobs,
  getStudentJobs,
  patchJob,
  postCreateJob,
  postHrDiscover,
  postStudentDiscover,
} from './jobs.controller.js';

export const jobsRouter: Router = Router();

jobsRouter.use(requireAuth);

// Student board — read on the student module (+ plan unlock); discovery writes rows
// so it needs write, mirroring how roadmap generation is gated.
const studentRead = requirePermission(STUDENT_MODULE, 'read');
const studentWrite = requirePermission(STUDENT_MODULE, 'write');
// HR posting surface — read to list, write to create/edit/delete/discover.
const hrRead = requirePermission(HR_MODULE, 'read');
const hrWrite = requirePermission(HR_MODULE, 'write');

// Student
jobsRouter.get('/', studentRead, asyncHandler(getStudentJobs));
jobsRouter.post('/discover', studentWrite, asyncHandler(postStudentDiscover));

// HR (mounted under /manage so the student board keeps the clean collection root)
jobsRouter.get('/manage', hrRead, asyncHandler(getHrJobs));
jobsRouter.post('/manage', hrWrite, asyncHandler(postCreateJob));
jobsRouter.post('/manage/discover', hrWrite, asyncHandler(postHrDiscover));
jobsRouter.patch('/manage/:id', hrWrite, asyncHandler(patchJob));
jobsRouter.delete('/manage/:id', hrWrite, asyncHandler(deleteJobHandler));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }
      if (err instanceof JobError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      req.log.error({ err }, 'jobs route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
