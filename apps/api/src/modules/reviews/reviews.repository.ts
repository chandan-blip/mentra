import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../../db.js';
import { createId } from '../../core/id.js';

/** A row of the `StudentReview` table. */
export type StudentReviewRow = {
  id: string;
  title: string;
  studentName: string | null;
  body: string | null;
  mediaType: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  visible: number;
  sortOrder: number;
  createdBy: string | null;
  createdAt: Date;
};

const COLS =
  '`id`, `title`, `studentName`, `body`, `mediaType`, `mediaUrl`, `thumbnailUrl`, `visible`, `sortOrder`, `createdBy`, `createdAt`';

export async function create(input: {
  title: string;
  studentName: string | null;
  body: string | null;
  mediaType: string;
  createdBy: string | null;
}): Promise<StudentReviewRow> {
  const id = createId();
  await db.execute<ResultSetHeader>(
    'INSERT INTO `StudentReview` (`id`, `title`, `studentName`, `body`, `mediaType`, `createdBy`) ' +
      'VALUES (:id, :title, :studentName, :body, :mediaType, :createdBy)',
    {
      id,
      title: input.title,
      studentName: input.studentName,
      body: input.body,
      mediaType: input.mediaType,
      createdBy: input.createdBy,
    },
  );
  const created = await findById(id);
  if (!created) throw new Error('failed to read back created review');
  return created;
}

export async function findById(id: string): Promise<StudentReviewRow | null> {
  const [rows] = await db.execute<(StudentReviewRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`StudentReview\` WHERE \`id\` = :id LIMIT 1`,
    { id },
  );
  return rows[0] ?? null;
}

/** All reviews, newest-arranged for management (visible + hidden). */
export async function listAll(): Promise<StudentReviewRow[]> {
  const [rows] = await db.execute<(StudentReviewRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`StudentReview\` ORDER BY \`sortOrder\` ASC, \`createdAt\` DESC`,
  );
  return rows;
}

/** Visible reviews with a finalized media URL — the student-facing gallery. */
export async function listVisible(): Promise<StudentReviewRow[]> {
  const [rows] = await db.execute<(StudentReviewRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`StudentReview\` WHERE \`visible\` = 1 AND \`mediaUrl\` IS NOT NULL ORDER BY \`sortOrder\` ASC, \`createdAt\` DESC`,
  );
  return rows;
}

export async function setMediaUrl(id: string, mediaUrl: string): Promise<void> {
  await db.execute<ResultSetHeader>('UPDATE `StudentReview` SET `mediaUrl` = :mediaUrl WHERE `id` = :id', {
    id,
    mediaUrl,
  });
}

export async function setThumbnailUrl(id: string, thumbnailUrl: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `StudentReview` SET `thumbnailUrl` = :thumbnailUrl WHERE `id` = :id',
    { id, thumbnailUrl },
  );
}

export async function update(
  id: string,
  fields: {
    title?: string;
    studentName?: string | null;
    body?: string | null;
    visible?: boolean;
    sortOrder?: number;
  },
): Promise<void> {
  const sets: string[] = [];
  const params: Record<string, string | number | null> = { id };
  if (fields.title !== undefined) {
    sets.push('`title` = :title');
    params.title = fields.title;
  }
  if (fields.studentName !== undefined) {
    sets.push('`studentName` = :studentName');
    params.studentName = fields.studentName;
  }
  if (fields.body !== undefined) {
    sets.push('`body` = :body');
    params.body = fields.body;
  }
  if (fields.visible !== undefined) {
    sets.push('`visible` = :visible');
    params.visible = fields.visible ? 1 : 0;
  }
  if (fields.sortOrder !== undefined) {
    sets.push('`sortOrder` = :sortOrder');
    params.sortOrder = fields.sortOrder;
  }
  if (sets.length === 0) return;
  await db.execute<ResultSetHeader>(`UPDATE \`StudentReview\` SET ${sets.join(', ')} WHERE \`id\` = :id`, params);
}

export async function remove(id: string): Promise<void> {
  await db.execute<ResultSetHeader>('DELETE FROM `StudentReview` WHERE `id` = :id', { id });
}
