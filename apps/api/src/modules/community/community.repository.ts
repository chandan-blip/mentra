import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db, type SqlParams } from '../../db.js';
import { createId } from '../../core/id.js';

/**
 * Data access for the community feed (posts + comments). No FK constraints — related
 * ids are plain columns; deleting a post manually removes its comments. Author name,
 * effective role, and avatar are joined in for display.
 */

export type PostRow = {
  id: string;
  authorId: string;
  body: string;
  mediaUrl: string | null;
  mediaType: string | null;
  mentions: unknown;
  pinned: 0 | 1 | boolean;
  editedAt: Date | null;
  createdAt: Date;
  authorName: string;
  authorRole: string;
  authorAvatar: string | null;
  commentCount: number;
};

export type CommentRow = {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  mentions: unknown;
  editedAt: Date | null;
  createdAt: Date;
  authorName: string;
  authorRole: string;
  authorAvatar: string | null;
};

export function jsonStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Effective role = RBAC roleId when set, else legacy role column.
const ROLE = "COALESCE(NULLIF(u.`roleId`, ''), u.`role`)";

const POST_SELECT =
  'SELECT p.`id`, p.`authorId`, p.`body`, p.`mediaUrl`, p.`mediaType`, p.`mentions`, p.`pinned`, p.`editedAt`, p.`createdAt`, ' +
  `u.\`name\` AS \`authorName\`, ${ROLE} AS \`authorRole\`, sp.\`avatarUrl\` AS \`authorAvatar\`, ` +
  '(SELECT COUNT(*) FROM `CommunityComment` c WHERE c.`postId` = p.`id`) AS `commentCount` ' +
  'FROM `CommunityPost` p JOIN `User` u ON u.`id` = p.`authorId` ' +
  'LEFT JOIN `StudentProfile` sp ON sp.`userId` = p.`authorId`';

const COMMENT_SELECT =
  'SELECT c.`id`, c.`postId`, c.`authorId`, c.`body`, c.`mentions`, c.`editedAt`, c.`createdAt`, ' +
  `u.\`name\` AS \`authorName\`, ${ROLE} AS \`authorRole\`, sp.\`avatarUrl\` AS \`authorAvatar\` ` +
  'FROM `CommunityComment` c JOIN `User` u ON u.`id` = c.`authorId` ' +
  'LEFT JOIN `StudentProfile` sp ON sp.`userId` = c.`authorId`';

// --- Posts ---

export async function createPost(input: {
  authorId: string;
  body: string;
  mediaUrl: string | null;
  mediaType: string | null;
  mentions: string[];
}): Promise<PostRow> {
  const id = createId();
  await db.execute<ResultSetHeader>(
    'INSERT INTO `CommunityPost` (`id`, `authorId`, `body`, `mediaUrl`, `mediaType`, `mentions`) ' +
      'VALUES (:id, :authorId, :body, :mediaUrl, :mediaType, :mentions)',
    {
      id,
      authorId: input.authorId,
      body: input.body,
      mediaUrl: input.mediaUrl,
      mediaType: input.mediaType,
      mentions: JSON.stringify(input.mentions),
    },
  );
  const created = await findPost(id);
  if (!created) throw new Error('failed to read back created post');
  return created;
}

export async function listPosts(opts: { authorId?: string; limit?: number } = {}): Promise<PostRow[]> {
  const limit = Math.trunc(opts.limit ?? 50);
  // A single author's feed (for their profile activity) pins nothing — order purely
  // by recency; the global feed keeps pinned posts on top.
  const where = opts.authorId ? 'WHERE p.`authorId` = :authorId' : '';
  const order = opts.authorId ? 'p.`createdAt` DESC' : 'p.`pinned` DESC, p.`createdAt` DESC';
  const [rows] = await db.execute<(PostRow & RowDataPacket)[]>(
    `${POST_SELECT} ${where} ORDER BY ${order} LIMIT ${limit}`,
    opts.authorId ? { authorId: opts.authorId } : {},
  );
  return rows;
}

export async function findPost(id: string): Promise<PostRow | null> {
  const [rows] = await db.execute<(PostRow & RowDataPacket)[]>(`${POST_SELECT} WHERE p.\`id\` = :id LIMIT 1`, { id });
  return rows[0] ?? null;
}

export async function updatePost(
  id: string,
  fields: { body?: string; mediaUrl?: string | null; mediaType?: string | null; mentions?: string[] },
): Promise<void> {
  const sets: string[] = ['`editedAt` = NOW(3)'];
  const params: SqlParams = { id };
  if (fields.body !== undefined) { sets.push('`body` = :body'); params.body = fields.body; }
  if (fields.mediaUrl !== undefined) { sets.push('`mediaUrl` = :mediaUrl'); params.mediaUrl = fields.mediaUrl; }
  if (fields.mediaType !== undefined) { sets.push('`mediaType` = :mediaType'); params.mediaType = fields.mediaType; }
  if (fields.mentions !== undefined) { sets.push('`mentions` = :mentions'); params.mentions = JSON.stringify(fields.mentions); }
  await db.execute<ResultSetHeader>(`UPDATE \`CommunityPost\` SET ${sets.join(', ')} WHERE \`id\` = :id`, params);
}

export async function deletePost(id: string): Promise<void> {
  await db.execute<ResultSetHeader>('DELETE FROM `CommunityComment` WHERE `postId` = :id', { id });
  await db.execute<ResultSetHeader>('DELETE FROM `CommunityPost` WHERE `id` = :id', { id });
}

export async function setPinned(id: string, pinned: boolean): Promise<void> {
  await db.execute<ResultSetHeader>('UPDATE `CommunityPost` SET `pinned` = :pinned WHERE `id` = :id', { id, pinned });
}

// --- Comments ---

export async function createComment(input: {
  postId: string;
  authorId: string;
  body: string;
  mentions: string[];
}): Promise<CommentRow> {
  const id = createId();
  await db.execute<ResultSetHeader>(
    'INSERT INTO `CommunityComment` (`id`, `postId`, `authorId`, `body`, `mentions`) VALUES (:id, :postId, :authorId, :body, :mentions)',
    { id, postId: input.postId, authorId: input.authorId, body: input.body, mentions: JSON.stringify(input.mentions) },
  );
  const created = await findComment(id);
  if (!created) throw new Error('failed to read back created comment');
  return created;
}

export async function listComments(postId: string, limit = 200): Promise<CommentRow[]> {
  const [rows] = await db.execute<(CommentRow & RowDataPacket)[]>(
    `${COMMENT_SELECT} WHERE c.\`postId\` = :postId ORDER BY c.\`createdAt\` ASC LIMIT ${Math.trunc(limit)}`,
    { postId },
  );
  return rows;
}

export async function findComment(id: string): Promise<CommentRow | null> {
  const [rows] = await db.execute<(CommentRow & RowDataPacket)[]>(`${COMMENT_SELECT} WHERE c.\`id\` = :id LIMIT 1`, {
    id,
  });
  return rows[0] ?? null;
}

export async function updateComment(id: string, body: string, mentions: string[]): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `CommunityComment` SET `body` = :body, `mentions` = :mentions, `editedAt` = NOW(3) WHERE `id` = :id',
    { id, body, mentions: JSON.stringify(mentions) },
  );
}

export async function deleteComment(id: string): Promise<void> {
  await db.execute<ResultSetHeader>('DELETE FROM `CommunityComment` WHERE `id` = :id', { id });
}

// --- Member search (mention autocomplete) ---

export async function searchMembers(q: string, limit = 8): Promise<{ id: string; name: string; role: string }[]> {
  const [rows] = await db.execute<({ id: string; name: string; role: string } & RowDataPacket)[]>(
    `SELECT u.\`id\`, u.\`name\`, ${ROLE} AS \`role\` FROM \`User\` u ` +
      "WHERE u.`status` = 'active' AND u.`name` LIKE :q ORDER BY u.`name` ASC " +
      `LIMIT ${Math.trunc(limit)}`,
    { q: `%${q}%` },
  );
  return rows;
}
