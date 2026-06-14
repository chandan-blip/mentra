import type { NotificationView } from '@mentra/shared';
import { logger } from '../../logger.js';
import { getMyAccess } from '../access/access.service.js';
import * as repo from './notification.repository.js';

/**
 * In-app notifications. `createNotification` is the single entry point other modules
 * call to drop a notification into a user's inbox; it never throws (a notification
 * failure must not break the action that triggered it).
 *
 * Notifications respect role/permissions: a notification tagged with a `moduleKey` is
 * only shown to a recipient who can currently access that module (admins see all;
 * general notifications with no moduleKey are always shown). This is enforced at read
 * time, so revoking access immediately hides the related notifications.
 */

export type NewNotification = {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  /** Module this notification belongs to; gates visibility by the recipient's access. */
  moduleKey?: string | null;
};

export async function createNotification(input: NewNotification): Promise<void> {
  try {
    await repo.insert({
      userId: input.userId,
      type: input.type,
      title: input.title.slice(0, 200),
      body: input.body ? input.body.slice(0, 500) : null,
      link: input.link ?? null,
      moduleKey: input.moduleKey ?? null,
    });
  } catch (err) {
    logger.warn({ err, type: input.type, userId: input.userId }, 'notification.create_failed');
  }
}

/** The recipient's access context: admin flag + the set of module keys they can read. */
async function accessContext(userId: string): Promise<{ isAdmin: boolean; allowed: Set<string> }> {
  try {
    const access = await getMyAccess(userId);
    const allowed = new Set(access.modules.filter((m) => m.canRead && m.unlocked).map((m) => m.key));
    return { isAdmin: access.isAdmin, allowed };
  } catch {
    return { isAdmin: false, allowed: new Set() };
  }
}

const visible = (moduleKey: string | null, ctx: { isAdmin: boolean; allowed: Set<string> }): boolean =>
  !moduleKey || ctx.isAdmin || ctx.allowed.has(moduleKey);

/** Fire several notifications (e.g. a batch of @mentions); de-dupes recipients and skips falsy ids. */
export async function notifyMany(userIds: string[], make: (userId: string) => NewNotification): Promise<void> {
  const seen = new Set<string>();
  for (const id of userIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    await createNotification(make(id));
  }
}

function toView(row: repo.NotificationRow): NotificationView {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    read: row.readAt !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listForUser(userId: string): Promise<NotificationView[]> {
  const [rows, ctx] = await Promise.all([repo.listByUser(userId), accessContext(userId)]);
  return rows.filter((r) => visible(r.moduleKey, ctx)).map(toView);
}

export async function unreadCount(userId: string): Promise<number> {
  const [keys, ctx] = await Promise.all([repo.unreadModuleKeys(userId), accessContext(userId)]);
  return keys.filter((k) => visible(k, ctx)).length;
}

export async function markRead(userId: string, id: string): Promise<void> {
  await repo.markRead(userId, id);
}

export async function markAllRead(userId: string): Promise<void> {
  await repo.markAllRead(userId);
}
