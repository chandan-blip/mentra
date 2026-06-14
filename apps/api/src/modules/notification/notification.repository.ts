import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../../db.js';
import { createId } from '../../core/id.js';

export type NotificationRow = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  moduleKey: string | null;
  readAt: Date | null;
  createdAt: Date;
};

const COLS = '`id`, `userId`, `type`, `title`, `body`, `link`, `moduleKey`, `readAt`, `createdAt`';

export async function insert(input: {
  userId: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  moduleKey: string | null;
}): Promise<void> {
  await db.execute<ResultSetHeader>(
    'INSERT INTO `Notification` (`id`, `userId`, `type`, `title`, `body`, `link`, `moduleKey`) ' +
      'VALUES (:id, :userId, :type, :title, :body, :link, :moduleKey)',
    { id: createId(), ...input },
  );
}

export async function listByUser(userId: string, limit = 50): Promise<NotificationRow[]> {
  const [rows] = await db.execute<(NotificationRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`Notification\` WHERE \`userId\` = :userId ORDER BY \`createdAt\` DESC LIMIT ${Math.trunc(limit)}`,
    { userId },
  );
  return rows;
}

/** Module keys of the user's unread notifications (null = general) — for access-aware counting. */
export async function unreadModuleKeys(userId: string): Promise<(string | null)[]> {
  const [rows] = await db.execute<({ moduleKey: string | null } & RowDataPacket)[]>(
    'SELECT `moduleKey` FROM `Notification` WHERE `userId` = :userId AND `readAt` IS NULL',
    { userId },
  );
  return rows.map((r) => r.moduleKey);
}

export async function markRead(userId: string, id: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `Notification` SET `readAt` = NOW(3) WHERE `id` = :id AND `userId` = :userId AND `readAt` IS NULL',
    { id, userId },
  );
}

export async function markAllRead(userId: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `Notification` SET `readAt` = NOW(3) WHERE `userId` = :userId AND `readAt` IS NULL',
    { userId },
  );
}
