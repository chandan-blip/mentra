import type { Request, Response } from 'express';
import { z } from 'zod';
import { createLiveSessionSchema, createUploadSchema, updateLiveSessionSchema } from '@mentra/shared';
import {
  createSession,
  createUpload,
  endSession,
  finalizeUpload,
  getJoinToken,
  getMessages,
  getOne,
  getProgress,
  getSummary,
  likeSession,
  listLive,
  listMine,
  listPast,
  listUpcoming,
  saveProgress,
  startSession,
  unlikeSession,
  updateSchedule,
} from './live-session.service.js';

const uid = (req: Request): string => req.auth!.sub;
const id = (req: Request): string => {
  const v = req.params.id;
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

export async function postCreate(req: Request, res: Response): Promise<void> {
  const input = createLiveSessionSchema.parse(req.body ?? {});
  res.json({ data: await createSession(uid(req), input) });
}

export async function getMine(req: Request, res: Response): Promise<void> {
  res.json({ data: await listMine(uid(req)) });
}

export async function postUpload(req: Request, res: Response): Promise<void> {
  const input = createUploadSchema.parse(req.body ?? {});
  res.json({ data: await createUpload(uid(req), input) });
}

export async function postFinalizeUpload(req: Request, res: Response): Promise<void> {
  res.json({ data: await finalizeUpload(uid(req), id(req)) });
}

export async function patchSchedule(req: Request, res: Response): Promise<void> {
  const input = updateLiveSessionSchema.parse(req.body ?? {});
  res.json({ data: await updateSchedule(uid(req), id(req), input) });
}

export async function postStart(req: Request, res: Response): Promise<void> {
  res.json({ data: await startSession(uid(req), id(req)) });
}

export async function postEnd(req: Request, res: Response): Promise<void> {
  res.json({ data: await endSession(uid(req), id(req)) });
}

export async function getLive(req: Request, res: Response): Promise<void> {
  res.json({ data: await listLive(uid(req)) });
}

export async function getUpcoming(req: Request, res: Response): Promise<void> {
  res.json({ data: await listUpcoming(uid(req)) });
}

export async function getPast(req: Request, res: Response): Promise<void> {
  res.json({ data: await listPast(uid(req)) });
}

export async function getChatHistory(req: Request, res: Response): Promise<void> {
  res.json({ data: await getMessages(uid(req), id(req)) });
}

export async function getById(req: Request, res: Response): Promise<void> {
  res.json({ data: await getOne(uid(req), id(req)) });
}

export async function postJoinToken(req: Request, res: Response): Promise<void> {
  res.json({ data: await getJoinToken(uid(req), id(req)) });
}

export async function getSessionSummary(req: Request, res: Response): Promise<void> {
  res.json({ data: await getSummary(uid(req), id(req)) });
}

export async function postLike(req: Request, res: Response): Promise<void> {
  res.json({ data: await likeSession(uid(req), id(req)) });
}

export async function deleteLike(req: Request, res: Response): Promise<void> {
  res.json({ data: await unlikeSession(uid(req), id(req)) });
}

const progressSchema = z.object({ positionSeconds: z.number().int().min(0).max(60 * 60 * 24) });

export async function getWatchProgress(req: Request, res: Response): Promise<void> {
  res.json({ data: await getProgress(uid(req), id(req)) });
}

export async function putWatchProgress(req: Request, res: Response): Promise<void> {
  const { positionSeconds } = progressSchema.parse(req.body ?? {});
  await saveProgress(uid(req), id(req), positionSeconds);
  res.json({ data: { ok: true } });
}
