import type { Request, Response } from 'express';
import { z } from 'zod';
import { createLiveSessionSchema, createUploadSchema, updateLiveSessionSchema } from '@mentra/shared';
import { env } from '../../env.js';
import { LiveSessionError } from './live-session.errors.js';
import { renderWatchOg, renderWatchUnavailable } from './og.js';
import {
  addMessage,
  createSession,
  createUpload,
  endSession,
  enrollSession,
  finalizeUpload,
  getJoinToken,
  getMessages,
  getOne,
  getProgress,
  getPublicVideo,
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

/** Public (no-auth) single video for the shareable /watch/:id page. */
export async function getPublicById(req: Request, res: Response): Promise<void> {
  res.json({ data: await getPublicVideo(id(req)) });
}

/**
 * Public (no-auth) Open Graph shell for /watch/:id — the only HTML the API serves.
 * nginx routes ONLY social crawlers here; they never run the SPA's JS, so without this
 * every shared session unfurls with the generic tags from apps/web/index.html. Humans
 * always fall through to the SPA. See og.ts and nginx/mentra.vps.conf.
 */
export async function getPublicOg(req: Request, res: Response): Promise<void> {
  let html: string;
  let status = 200;
  try {
    html = renderWatchOg(await getPublicVideo(id(req)), env.WEB_APP_ORIGIN);
  } catch (err) {
    // Private / hidden / still-transcoding → no preview, same gate as the page. Any
    // other failure is a real fault: let asyncHandler log and 500 it rather than
    // reporting a missing video.
    if (!(err instanceof LiveSessionError) || err.status !== 404) throw err;
    html = renderWatchUnavailable(env.WEB_APP_ORIGIN);
    status = 404;
  }
  res.status(status).type('html').set('Cache-Control', 'public, max-age=300').send(html);
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

const messageSchema = z.object({ body: z.string().trim().min(1).max(1000) });

export async function postMessage(req: Request, res: Response): Promise<void> {
  const { body } = messageSchema.parse(req.body ?? {});
  res.json({ data: await addMessage(uid(req), id(req), body) });
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

export async function postEnroll(req: Request, res: Response): Promise<void> {
  res.json({ data: await enrollSession(uid(req), id(req)) });
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
