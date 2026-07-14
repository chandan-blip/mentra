import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { CareerChatKind, CareerChatRole } from '@mentra/shared';
import { db } from '../../db.js';
import { createId } from '../../core/id.js';

export type CareerChatRow = {
  id: string;
  userId: string;
  role: CareerChatRole;
  kind: CareerChatKind;
  body: string;
  sessionId: string | null;
  /** mysql2 returns TINYINT(1) as a number (0/1). */
  enrolled: number;
  /** 1 when the coach's AI reply to this student turn failed (busy-mentor mode). */
  issue: number;
  createdAt: Date;
};

const COLS = '`id`, `userId`, `role`, `kind`, `body`, `sessionId`, `enrolled`, `issue`, `createdAt`';

export type NewMessage = {
  userId: string;
  role: CareerChatRole;
  kind: CareerChatKind;
  body: string;
  sessionId?: string | null;
};

export async function insertMessage(input: NewMessage): Promise<CareerChatRow> {
  const id = createId();
  await db.execute<ResultSetHeader>(
    'INSERT INTO `CareerChatMessage` (`id`, `userId`, `role`, `kind`, `body`, `sessionId`) ' +
      'VALUES (:id, :userId, :role, :kind, :body, :sessionId)',
    {
      id,
      userId: input.userId,
      role: input.role,
      kind: input.kind,
      body: input.body,
      sessionId: input.sessionId ?? null,
    },
  );
  const row = await findById(id);
  if (!row) throw new Error('failed to read back career-chat message');
  return row;
}

export async function findById(id: string): Promise<CareerChatRow | null> {
  const [rows] = await db.execute<(CareerChatRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`CareerChatMessage\` WHERE \`id\` = :id LIMIT 1`,
    { id },
  );
  return rows[0] ?? null;
}

/** The whole conversation for a student, oldest-first. */
export async function listByUser(userId: string, limit = 300): Promise<CareerChatRow[]> {
  const [rows] = await db.query<(CareerChatRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`CareerChatMessage\` WHERE \`userId\` = ? ORDER BY \`createdAt\` ASC LIMIT ?`,
    [userId, limit],
  );
  return rows;
}

export async function countByUser(userId: string): Promise<number> {
  const [rows] = await db.execute<({ n: number } & RowDataPacket)[]>(
    'SELECT COUNT(*) AS `n` FROM `CareerChatMessage` WHERE `userId` = :userId',
    { userId },
  );
  return Number(rows[0]?.n ?? 0);
}

/** The most recent session-invite this student got for a given session (or null). */
export async function findInvite(userId: string, sessionId: string): Promise<CareerChatRow | null> {
  const [rows] = await db.query<(CareerChatRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`CareerChatMessage\` ` +
      "WHERE `userId` = ? AND `sessionId` = ? AND `kind` = 'session-invite' " +
      'ORDER BY `createdAt` DESC LIMIT 1',
    [userId, sessionId],
  );
  return rows[0] ?? null;
}

/** How many of the student's last `window` messages are un-enrolled session invites. */
export async function pendingInviteCount(userId: string, window = 6): Promise<number> {
  const [rows] = await db.query<({ n: number } & RowDataPacket)[]>(
    'SELECT COUNT(*) AS `n` FROM (' +
      `SELECT \`kind\`, \`enrolled\` FROM \`CareerChatMessage\` WHERE \`userId\` = ? ` +
      'ORDER BY `createdAt` DESC LIMIT ?' +
      ") AS recent WHERE `kind` = 'session-invite' AND `enrolled` = 0",
    [userId, window],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function markEnrolled(id: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `CareerChatMessage` SET `enrolled` = 1 WHERE `id` = :id',
    { id },
  );
}

/** Flag a student turn whose AI reply failed — drives the busy-mentor reply cadence. */
export async function markIssue(id: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `CareerChatMessage` SET `issue` = 1 WHERE `id` = :id',
    { id },
  );
}

/** The student's own display name — used when posting the "Enrolled!" comment. */
export async function findUserName(userId: string): Promise<string | null> {
  const [rows] = await db.execute<({ name: string } & RowDataPacket)[]>(
    'SELECT `name` FROM `User` WHERE `id` = :userId LIMIT 1',
    { userId },
  );
  return rows[0]?.name ?? null;
}
