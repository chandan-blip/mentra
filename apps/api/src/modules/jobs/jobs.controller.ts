import type { Request, Response } from 'express';
import {
  createJobSchema,
  discoverJobsSchema,
  hrDiscoverJobsSchema,
  updateJobSchema,
} from '@mentra/shared';
import {
  createJob,
  deleteJob,
  discoverForHr,
  discoverForStudent,
  listForHr,
  listForStudent,
  updateJob,
} from './jobs.service.js';

const uid = (req: Request): string => req.auth!.sub;
const id = (req: Request): string => {
  const v = req.params.id;
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

// --- Student board ---

export async function getStudentJobs(req: Request, res: Response): Promise<void> {
  res.json({ data: await listForStudent(uid(req)) });
}

export async function postStudentDiscover(req: Request, res: Response): Promise<void> {
  const input = discoverJobsSchema.parse(req.body ?? {});
  res.json({ data: await discoverForStudent(uid(req), input) });
}

// --- HR management ---

export async function getHrJobs(req: Request, res: Response): Promise<void> {
  res.json({ data: await listForHr() });
}

export async function postCreateJob(req: Request, res: Response): Promise<void> {
  const input = createJobSchema.parse(req.body ?? {});
  res.json({ data: await createJob(uid(req), input) });
}

export async function patchJob(req: Request, res: Response): Promise<void> {
  const input = updateJobSchema.parse(req.body ?? {});
  res.json({ data: await updateJob(uid(req), id(req), input) });
}

export async function deleteJobHandler(req: Request, res: Response): Promise<void> {
  await deleteJob(uid(req), id(req));
  res.json({ data: { ok: true } });
}

export async function postHrDiscover(req: Request, res: Response): Promise<void> {
  const input = hrDiscoverJobsSchema.parse(req.body ?? {});
  res.json({ data: await discoverForHr(uid(req), input) });
}
