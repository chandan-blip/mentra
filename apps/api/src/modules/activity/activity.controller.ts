import type { Request, Response } from 'express';
import { ingestActivitySchema } from '@mentra/shared';
import {
  getFocus,
  getPublicSummary,
  getSummary,
  getTimeline,
  ingestClientEvents,
} from './activity.service.js';

const uid = (req: Request): string => req.auth!.sub;
const paramId = (req: Request): string => {
  const v = req.params.userId;
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

export async function postEvents(req: Request, res: Response): Promise<void> {
  const input = ingestActivitySchema.parse(req.body ?? {});
  res.json({ data: await ingestClientEvents(uid(req), input) });
}

export async function getMine(req: Request, res: Response): Promise<void> {
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 30;
  res.json({ data: await getTimeline(uid(req), Number.isFinite(limit) ? limit : 30) });
}

export async function getMySummary(req: Request, res: Response): Promise<void> {
  res.json({ data: await getSummary(uid(req)) });
}

export async function getMyFocus(req: Request, res: Response): Promise<void> {
  res.json({ data: await getFocus(uid(req)) });
}

/** Curated, public-safe activity for another student's profile. */
export async function getUserSummary(req: Request, res: Response): Promise<void> {
  res.json({ data: await getPublicSummary(paramId(req)) });
}
