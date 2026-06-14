import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../../db.js';
import { createId } from '../../core/id.js';

export type ConnectionRow = {
  id: string;
  userId: string;
  channel: string;
  handle: string;
  displayName: string | null;
  providerId: string | null;
  accessToken: string | null;
  tokenExpiresAt: Date | null;
  scope: string | null;
  connectedAt: Date;
};

const COLS =
  '`id`, `userId`, `channel`, `handle`, `displayName`, `providerId`, `accessToken`, `tokenExpiresAt`, `scope`, `connectedAt`';

export async function listConnections(userId: string): Promise<ConnectionRow[]> {
  const [rows] = await db.execute<(ConnectionRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`MarketingConnection\` WHERE \`userId\` = :userId ORDER BY \`channel\` ASC`,
    { userId },
  );
  return rows;
}

export async function findConnection(userId: string, channel: string): Promise<ConnectionRow | null> {
  const [rows] = await db.execute<(ConnectionRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`MarketingConnection\` WHERE \`userId\` = :userId AND \`channel\` = :channel LIMIT 1`,
    { userId, channel },
  );
  return rows[0] ?? null;
}

/** Connect or update a channel for the user (one row per user+channel). */
export async function upsertConnection(input: {
  userId: string;
  channel: string;
  handle: string;
  displayName: string | null;
  providerId?: string | null;
  accessToken?: string | null;
  tokenExpiresAt?: Date | null;
  scope?: string | null;
}): Promise<void> {
  const params = {
    userId: input.userId,
    channel: input.channel,
    handle: input.handle,
    displayName: input.displayName,
    providerId: input.providerId ?? null,
    accessToken: input.accessToken ?? null,
    tokenExpiresAt: input.tokenExpiresAt ?? null,
    scope: input.scope ?? null,
  };
  const [res] = await db.execute<ResultSetHeader>(
    'UPDATE `MarketingConnection` SET `handle` = :handle, `displayName` = :displayName, `providerId` = :providerId, ' +
      '`accessToken` = :accessToken, `tokenExpiresAt` = :tokenExpiresAt, `scope` = :scope, `connectedAt` = NOW(3) ' +
      'WHERE `userId` = :userId AND `channel` = :channel',
    params,
  );
  if (res.affectedRows === 0) {
    await db.execute<ResultSetHeader>(
      'INSERT INTO `MarketingConnection` (`id`, `userId`, `channel`, `handle`, `displayName`, `providerId`, `accessToken`, `tokenExpiresAt`, `scope`) ' +
        'VALUES (:id, :userId, :channel, :handle, :displayName, :providerId, :accessToken, :tokenExpiresAt, :scope)',
      { id: createId(), ...params },
    );
  }
}

export async function deleteConnection(userId: string, channel: string): Promise<void> {
  await db.execute<ResultSetHeader>('DELETE FROM `MarketingConnection` WHERE `userId` = :userId AND `channel` = :channel', {
    userId,
    channel,
  });
}

// --- Posts ---

export type PostRow = {
  id: string;
  channel: string;
  body: string;
  mediaUrl: string | null;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  providerPostUrn: string | null;
  postedAt: Date;
};

const POST_COLS =
  '`id`, `channel`, `body`, `mediaUrl`, `likes`, `comments`, `shares`, `impressions`, `providerPostUrn`, `postedAt`';

export async function createPost(input: {
  userId: string;
  channel: string;
  body: string;
  mediaUrl: string | null;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
}): Promise<PostRow> {
  const id = createId();
  await db.execute<ResultSetHeader>(
    'INSERT INTO `MarketingPost` (`id`, `userId`, `channel`, `body`, `mediaUrl`, `likes`, `comments`, `shares`, `impressions`) ' +
      'VALUES (:id, :userId, :channel, :body, :mediaUrl, :likes, :comments, :shares, :impressions)',
    { id, ...input },
  );
  const [rows] = await db.execute<(PostRow & RowDataPacket)[]>(
    `SELECT ${POST_COLS} FROM \`MarketingPost\` WHERE \`id\` = :id LIMIT 1`,
    { id },
  );
  if (!rows[0]) throw new Error('failed to read back created post');
  return rows[0];
}

export async function listPosts(userId: string, channel: string): Promise<PostRow[]> {
  const [rows] = await db.execute<(PostRow & RowDataPacket)[]>(
    `SELECT ${POST_COLS} FROM \`MarketingPost\` WHERE \`userId\` = :userId AND \`channel\` = :channel ORDER BY \`postedAt\` DESC`,
    { userId, channel },
  );
  return rows;
}

export async function createPostWithUrn(input: {
  userId: string;
  channel: string;
  body: string;
  mediaUrl: string | null;
  providerPostUrn: string | null;
}): Promise<PostRow> {
  const id = createId();
  await db.execute<ResultSetHeader>(
    'INSERT INTO `MarketingPost` (`id`, `userId`, `channel`, `body`, `mediaUrl`, `providerPostUrn`) ' +
      'VALUES (:id, :userId, :channel, :body, :mediaUrl, :providerPostUrn)',
    { id, ...input },
  );
  const [rows] = await db.execute<(PostRow & RowDataPacket)[]>(
    `SELECT ${POST_COLS} FROM \`MarketingPost\` WHERE \`id\` = :id LIMIT 1`,
    { id },
  );
  if (!rows[0]) throw new Error('failed to read back created post');
  return rows[0];
}

export async function updatePostStats(id: string, likes: number, comments: number): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `MarketingPost` SET `likes` = :likes, `comments` = :comments, `statsSyncedAt` = NOW(3) WHERE `id` = :id',
    { id, likes, comments },
  );
}
