import { randomUUID } from 'node:crypto';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { enqueueObjectDelete } from '../../core/queue.js';
import { readObject, saveObject } from '../../core/storage.js';
import { ProfileError } from './user-profile.service.js';
import { clearResume, findProfileByUserId, setResume } from './user-profile.repository.js';

const PDF_MAGIC = Buffer.from('%PDF-');

export type StoreResult = { resumeFileKey: string; resumeUploadedAt: string };

export async function storeResume(userId: string, body: Buffer): Promise<StoreResult> {
  if (body.length === 0) {
    throw new ProfileError('RESUME_EMPTY', 'No file received', 400);
  }
  if (body.length > env.RESUME_MAX_BYTES) {
    logger.warn({ userId, size: body.length, reason: 'size' }, 'profile.resume.upload_rejected');
    throw new ProfileError('RESUME_TOO_LARGE', 'Resume must be 5 MB or smaller', 413);
  }
  if (!body.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    logger.warn({ userId, reason: 'mime' }, 'profile.resume.upload_rejected');
    throw new ProfileError('RESUME_BAD_TYPE', 'Resume must be a PDF', 415);
  }

  const fileKey = `resumes/${userId}/${randomUUID()}.pdf`;
  await saveObject(fileKey, body);

  const previous = await findProfileByUserId(userId);
  const uploadedAt = new Date();
  await setResume(userId, fileKey, uploadedAt);

  // Soft-delete the replaced resume after the recovery window.
  if (previous?.resumeFileKey && previous.resumeFileKey !== fileKey) {
    await enqueueObjectDelete(previous.resumeFileKey);
  }

  logger.info({ userId, fileKey }, 'profile.resume.upload_confirmed');
  return { resumeFileKey: fileKey, resumeUploadedAt: uploadedAt.toISOString() };
}

export async function getResumeBytes(userId: string): Promise<Buffer> {
  const profile = await findProfileByUserId(userId);
  if (!profile?.resumeFileKey) {
    throw new ProfileError('RESUME_NOT_FOUND', 'No resume uploaded', 404);
  }
  return readObject(profile.resumeFileKey);
}

export async function deleteResume(userId: string): Promise<void> {
  const profile = await findProfileByUserId(userId);
  if (!profile?.resumeFileKey) return;
  await clearResume(userId);
  await enqueueObjectDelete(profile.resumeFileKey);
  logger.info({ userId, fileKey: profile.resumeFileKey }, 'profile.resume.deleted');
}
