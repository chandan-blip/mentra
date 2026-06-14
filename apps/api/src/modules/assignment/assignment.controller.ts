import type { Request, Response } from 'express';
import { assignmentSubmissionSchema } from '@mentra/shared';
import { getAssignmentStatus, getAssignmentView, submitAssignment } from './assignment.service.js';

const uid = (req: Request): string => req.auth!.sub;

export async function getMe(req: Request, res: Response): Promise<void> {
  res.json({ data: await getAssignmentView(uid(req)) });
}

export async function getStatus(req: Request, res: Response): Promise<void> {
  res.json({ data: await getAssignmentStatus(uid(req)) });
}

export async function postSubmit(req: Request, res: Response): Promise<void> {
  const submission = assignmentSubmissionSchema.parse(req.body ?? {});
  res.json({ data: await submitAssignment(uid(req), submission) });
}
