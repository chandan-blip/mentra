import type { Request, Response } from 'express';
import { createReviewSchema, updateReviewSchema } from '@mentra/shared';
import {
  createReview,
  deleteReview,
  finalizeReview,
  listForManagers,
  listForStudents,
  updateReview,
} from './reviews.service.js';

const uid = (req: Request): string => req.auth!.sub;
const id = (req: Request): string => {
  const v = req.params.id;
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

// --- Student surface ---

export async function getPublishedReviews(_req: Request, res: Response): Promise<void> {
  res.json({ data: await listForStudents() });
}

// --- Manager surface ---

export async function getAllReviews(_req: Request, res: Response): Promise<void> {
  res.json({ data: await listForManagers() });
}

export async function postCreateReview(req: Request, res: Response): Promise<void> {
  const input = createReviewSchema.parse(req.body ?? {});
  res.json({ data: await createReview(uid(req), input) });
}

export async function postFinalizeReview(req: Request, res: Response): Promise<void> {
  res.json({ data: await finalizeReview(id(req)) });
}

export async function patchReview(req: Request, res: Response): Promise<void> {
  const input = updateReviewSchema.parse(req.body ?? {});
  res.json({ data: await updateReview(id(req), input) });
}

export async function deleteReviewById(req: Request, res: Response): Promise<void> {
  await deleteReview(id(req));
  res.json({ data: { ok: true } });
}
