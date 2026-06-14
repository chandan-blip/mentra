import { randomUUID } from 'node:crypto';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { enqueueObjectDelete } from '../../core/queue.js';
import { readObject, saveObject } from '../../core/storage.js';
import { ProfileError, ensureProfile } from './user-profile.service.js';
import { clearAvatar, findProfileByUserId, setAvatar } from './user-profile.repository.js';

/**
 * Profile-picture upload. Mirrors resume.service: the image is validated by its
 * magic bytes, stored on disk under `avatars/<userId>/<uuid>.<ext>`, and the
 * StudentProfile row gets both the storage key (`avatarFileKey`) and a servable URL
 * (`avatarUrl`). The URL points at the public GET route so it loads in an <img>
 * (which can't send an auth header) and is visible to other users (e.g. students
 * browsing mentors). The previous file is soft-deleted after the recovery window.
 */

type ImageKind = { ext: 'png' | 'jpg' | 'webp'; contentType: string };

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/** Sniff the image type from magic bytes — don't trust the client's Content-Type. */
function detectImage(body: Buffer): ImageKind {
  if (body.length >= 8 && body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e && body[3] === 0x47) {
    return { ext: 'png', contentType: 'image/png' };
  }
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' };
  }
  if (body.length >= 12 && body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', contentType: 'image/webp' };
  }
  throw new ProfileError('AVATAR_BAD_TYPE', 'Profile picture must be a PNG, JPEG or WebP image', 415);
}

export type AvatarResult = { avatarUrl: string };

export async function storeAvatar(userId: string, body: Buffer): Promise<AvatarResult> {
  if (body.length === 0) {
    throw new ProfileError('AVATAR_EMPTY', 'No file received', 400);
  }
  if (body.length > env.AVATAR_MAX_BYTES) {
    logger.warn({ userId, size: body.length, reason: 'size' }, 'profile.avatar.upload_rejected');
    throw new ProfileError('AVATAR_TOO_LARGE', 'Profile picture must be 2 MB or smaller', 413);
  }
  const kind = detectImage(body);

  // A StudentProfile row must exist (mentors may not have touched onboarding yet).
  await ensureProfile(userId);
  const previous = await findProfileByUserId(userId);

  const fileKey = `avatars/${userId}/${randomUUID()}.${kind.ext}`;
  await saveObject(fileKey, body);

  // Store a ROOT-RELATIVE URL (no host): a reverse proxy may strip the port from
  // the Host header, so the host isn't reliable here. The frontend resolves it
  // against its known API base; `?v=` busts the <img> cache after a replace.
  const avatarUrl = `/api/v1/profile/avatar/${userId}?v=${Date.now()}`;
  await setAvatar(userId, fileKey, avatarUrl);

  if (previous?.avatarFileKey && previous.avatarFileKey !== fileKey) {
    await enqueueObjectDelete(previous.avatarFileKey);
  }

  logger.info({ userId, fileKey }, 'profile.avatar.upload_confirmed');
  return { avatarUrl };
}

export type AvatarBytes = { bytes: Buffer; contentType: string };

export async function getAvatarBytes(userId: string): Promise<AvatarBytes> {
  const profile = await findProfileByUserId(userId);
  if (!profile?.avatarFileKey) {
    throw new ProfileError('AVATAR_NOT_FOUND', 'No profile picture', 404);
  }
  const ext = profile.avatarFileKey.split('.').pop()?.toLowerCase() ?? '';
  return {
    bytes: await readObject(profile.avatarFileKey),
    contentType: CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream',
  };
}

export async function deleteAvatar(userId: string): Promise<void> {
  const profile = await findProfileByUserId(userId);
  if (!profile?.avatarFileKey) return;
  await clearAvatar(userId);
  await enqueueObjectDelete(profile.avatarFileKey);
  logger.info({ userId, fileKey: profile.avatarFileKey }, 'profile.avatar.deleted');
}
