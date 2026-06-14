import type { Request, Response } from 'express';
import {
  notificationPrefsPatchSchema,
  onboardingStepRequestSchema,
  profilePatchSchema,
} from '@mentra/shared';
import { searchSkills } from './skills.service.js';
import { submitOnboardingStep } from './onboarding.service.js';
import { deleteResume, getResumeBytes, storeResume } from './resume.service.js';
import { deleteAvatar, getAvatarBytes, storeAvatar } from './avatar.service.js';
import {
  getNotificationPrefs,
  getProfileMe,
  patchNotificationPrefs,
  patchProfile,
} from './user-profile.service.js';

function userId(req: Request): string {
  return req.auth!.sub;
}

export async function getMe(req: Request, res: Response): Promise<void> {
  res.json({ data: await getProfileMe(userId(req)) });
}

export async function patchMe(req: Request, res: Response): Promise<void> {
  const input = profilePatchSchema.parse(req.body);
  res.json({ data: await patchProfile(userId(req), input) });
}

export async function postOnboardingStep(req: Request, res: Response): Promise<void> {
  const { step, fields } = onboardingStepRequestSchema.parse(req.body);
  res.json({ data: await submitOnboardingStep(userId(req), step, fields) });
}

export async function postResume(req: Request, res: Response): Promise<void> {
  // express.raw() leaves the PDF bytes on req.body as a Buffer.
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  res.json({ data: await storeResume(userId(req), body) });
}

export async function getResume(req: Request, res: Response): Promise<void> {
  const bytes = await getResumeBytes(userId(req));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="resume.pdf"');
  res.send(bytes);
}

export async function deleteResumeHandler(req: Request, res: Response): Promise<void> {
  await deleteResume(userId(req));
  res.status(204).send();
}

export async function postAvatar(req: Request, res: Response): Promise<void> {
  // express.raw() leaves the image bytes on req.body as a Buffer.
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  res.json({ data: await storeAvatar(userId(req), body) });
}

export async function deleteAvatarHandler(req: Request, res: Response): Promise<void> {
  await deleteAvatar(userId(req));
  res.status(204).send();
}

/** Public: streams a user's avatar so it can be loaded by an <img> tag (no auth). */
export async function getAvatarPublic(req: Request, res: Response): Promise<void> {
  const raw = req.params.userId;
  const targetId = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
  const { bytes, contentType } = await getAvatarBytes(targetId);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(bytes);
}

export async function getNotifications(req: Request, res: Response): Promise<void> {
  res.json({ data: await getNotificationPrefs(userId(req)) });
}

export async function patchNotifications(req: Request, res: Response): Promise<void> {
  const input = notificationPrefsPatchSchema.parse(req.body);
  res.json({ data: await patchNotificationPrefs(userId(req), input) });
}

export async function getSkillsCatalogue(req: Request, res: Response): Promise<void> {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  res.json({ data: searchSkills(q) });
}
