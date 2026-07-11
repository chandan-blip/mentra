import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  createThumbnailUpload,
  deleteVideo,
  finalizeThumbnail,
  listVideos,
  regenerateThumbnail,
  setPublic,
  setVisibility,
  updateVideo,
} from './video-admin.service.js';

const uid = (req: Request): string => req.auth!.sub;
const id = (req: Request): string => {
  const v = req.params.id;
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  topic: z.string().trim().min(1).max(120).optional(),
});
const visibilitySchema = z.object({ visible: z.boolean() });
const publicSchema = z.object({ isPublic: z.boolean() });
const thumbUploadSchema = z.object({ contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']) });
const thumbFinalizeSchema = z.object({ key: z.string().min(1) });

export async function getVideos(req: Request, res: Response): Promise<void> {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  res.json({ data: await listVideos(uid(req), search) });
}

export async function patchVideo(req: Request, res: Response): Promise<void> {
  const input = updateSchema.parse(req.body ?? {});
  res.json({ data: await updateVideo(id(req), input) });
}

export async function postVisibility(req: Request, res: Response): Promise<void> {
  const { visible } = visibilitySchema.parse(req.body ?? {});
  res.json({ data: await setVisibility(id(req), visible) });
}

export async function postPublic(req: Request, res: Response): Promise<void> {
  const { isPublic } = publicSchema.parse(req.body ?? {});
  res.json({ data: await setPublic(id(req), isPublic) });
}

export async function removeVideo(req: Request, res: Response): Promise<void> {
  await deleteVideo(id(req));
  res.json({ data: { ok: true } });
}

export async function postRegenerateThumbnail(req: Request, res: Response): Promise<void> {
  await regenerateThumbnail(id(req));
  res.json({ data: { ok: true } });
}

export async function postThumbnailUpload(req: Request, res: Response): Promise<void> {
  const { contentType } = thumbUploadSchema.parse(req.body ?? {});
  res.json({ data: await createThumbnailUpload(id(req), contentType) });
}

export async function postThumbnailFinalize(req: Request, res: Response): Promise<void> {
  const { key } = thumbFinalizeSchema.parse(req.body ?? {});
  res.json({ data: await finalizeThumbnail(id(req), key) });
}
