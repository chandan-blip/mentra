import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db, type SqlParams } from '../../db.js';
import { createId } from '../../core/id.js';

export type LiveSessionRow = {
  id: string;
  mentorId: string;
  title: string;
  topic: string;
  status: 'scheduled' | 'live' | 'ended' | 'canceled';
  scheduledFor: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  livekitRoom: string;
  currentViewers: number;
  peakViewers: number;
  createdAt: Date;
};

const COLS =
  '`id`, `mentorId`, `title`, `topic`, `status`, `scheduledFor`, `startedAt`, `endedAt`, `livekitRoom`, `currentViewers`, `peakViewers`, `createdAt`';

// --- Sessions ---

export async function createSession(input: {
  mentorId: string;
  title: string;
  topic: string;
  status: 'scheduled' | 'live';
  scheduledFor: Date | null;
  startedAt: Date | null;
}): Promise<LiveSessionRow> {
  const id = createId();
  const livekitRoom = `ls_${id}`;
  await db.execute<ResultSetHeader>(
    'INSERT INTO `LiveSession` (`id`, `mentorId`, `title`, `topic`, `status`, `scheduledFor`, `startedAt`, `livekitRoom`) ' +
      'VALUES (:id, :mentorId, :title, :topic, :status, :scheduledFor, :startedAt, :livekitRoom)',
    {
      id,
      mentorId: input.mentorId,
      title: input.title,
      topic: input.topic,
      status: input.status,
      scheduledFor: input.scheduledFor,
      startedAt: input.startedAt,
      livekitRoom,
    },
  );
  const created = await findById(id);
  if (!created) throw new Error('failed to read back created live session');
  return created;
}

export async function findById(id: string): Promise<LiveSessionRow | null> {
  const [rows] = await db.execute<(LiveSessionRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`LiveSession\` WHERE \`id\` = :id LIMIT 1`,
    { id },
  );
  return rows[0] ?? null;
}

export async function findByRoom(room: string): Promise<LiveSessionRow | null> {
  const [rows] = await db.execute<(LiveSessionRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`LiveSession\` WHERE \`livekitRoom\` = :room LIMIT 1`,
    { room },
  );
  return rows[0] ?? null;
}

export async function listLive(): Promise<LiveSessionRow[]> {
  const [rows] = await db.execute<(LiveSessionRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`LiveSession\` WHERE \`status\` = 'live' ORDER BY \`startedAt\` DESC`,
  );
  return rows;
}

export async function listUpcoming(): Promise<LiveSessionRow[]> {
  const [rows] = await db.execute<(LiveSessionRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`LiveSession\` WHERE \`status\` = 'scheduled' AND (\`scheduledFor\` IS NULL OR \`scheduledFor\` >= NOW(3)) ORDER BY \`scheduledFor\` ASC`,
  );
  return rows;
}

export async function listPast(limit = 50): Promise<LiveSessionRow[]> {
  const [rows] = await db.query<(LiveSessionRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`LiveSession\` WHERE \`status\` = 'ended' ORDER BY \`endedAt\` DESC LIMIT ?`,
    [limit],
  );
  return rows;
}

export async function listByMentor(mentorId: string): Promise<LiveSessionRow[]> {
  const [rows] = await db.execute<(LiveSessionRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`LiveSession\` WHERE \`mentorId\` = :mentorId ORDER BY \`createdAt\` DESC`,
    { mentorId },
  );
  return rows;
}

/** Partial edit of a scheduled session (only provided fields change). */
export async function updateScheduled(
  id: string,
  fields: { title?: string; topic?: string; scheduledFor?: Date | null },
): Promise<void> {
  const sets: string[] = [];
  const params: SqlParams = { id };
  if (fields.title !== undefined) {
    sets.push('`title` = :title');
    params.title = fields.title;
  }
  if (fields.topic !== undefined) {
    sets.push('`topic` = :topic');
    params.topic = fields.topic;
  }
  if (fields.scheduledFor !== undefined) {
    sets.push('`scheduledFor` = :scheduledFor');
    params.scheduledFor = fields.scheduledFor;
  }
  if (sets.length === 0) return;
  await db.execute<ResultSetHeader>(
    `UPDATE \`LiveSession\` SET ${sets.join(', ')} WHERE \`id\` = :id`,
    params,
  );
}

export async function markLive(id: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    "UPDATE `LiveSession` SET `status` = 'live', `startedAt` = COALESCE(`startedAt`, NOW(3)) WHERE `id` = :id",
    { id },
  );
}

export async function markEnded(id: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    "UPDATE `LiveSession` SET `status` = 'ended', `endedAt` = NOW(3), `currentViewers` = 0 WHERE `id` = :id",
    { id },
  );
}

// --- Viewer count (students only) ---

export async function incrementViewers(id: string): Promise<number> {
  await db.execute<ResultSetHeader>(
    'UPDATE `LiveSession` SET `currentViewers` = `currentViewers` + 1, `peakViewers` = GREATEST(`peakViewers`, `currentViewers` + 1) WHERE `id` = :id',
    { id },
  );
  return readViewerCount(id);
}

export async function decrementViewers(id: string): Promise<number> {
  await db.execute<ResultSetHeader>(
    'UPDATE `LiveSession` SET `currentViewers` = GREATEST(0, `currentViewers` - 1) WHERE `id` = :id',
    { id },
  );
  return readViewerCount(id);
}

async function readViewerCount(id: string): Promise<number> {
  const [rows] = await db.execute<({ currentViewers: number } & RowDataPacket)[]>(
    'SELECT `currentViewers` FROM `LiveSession` WHERE `id` = :id LIMIT 1',
    { id },
  );
  return rows[0]?.currentViewers ?? 0;
}

// --- Attendance (interval rows) ---

export async function openInterval(input: {
  sessionId: string;
  userId: string;
  roleAtJoin: 'mentor' | 'student';
}): Promise<void> {
  await db.execute<ResultSetHeader>(
    'INSERT INTO `SessionParticipant` (`id`, `sessionId`, `userId`, `roleAtJoin`) VALUES (:id, :sessionId, :userId, :roleAtJoin)',
    { id: createId(), sessionId: input.sessionId, userId: input.userId, roleAtJoin: input.roleAtJoin },
  );
}

/** Close the most recent still-open interval for a user in a session. */
export async function closeInterval(sessionId: string, userId: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `SessionParticipant` SET `leftAt` = NOW(3), `attendedSeconds` = TIMESTAMPDIFF(SECOND, `joinedAt`, NOW(3)) ' +
      'WHERE `sessionId` = :sessionId AND `userId` = :userId AND `leftAt` IS NULL ORDER BY `joinedAt` DESC LIMIT 1',
    { sessionId, userId },
  );
}

/** Close every open interval for a session (used on room_finished). */
export async function closeAllIntervals(sessionId: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `SessionParticipant` SET `leftAt` = NOW(3), `attendedSeconds` = TIMESTAMPDIFF(SECOND, `joinedAt`, NOW(3)) ' +
      'WHERE `sessionId` = :sessionId AND `leftAt` IS NULL',
    { sessionId },
  );
}

export type AttendanceRow = {
  userId: string;
  seconds: number;
  firstJoin: Date;
  lastSeen: Date;
};

export async function attendanceBySession(sessionId: string): Promise<AttendanceRow[]> {
  const [rows] = await db.execute<(AttendanceRow & RowDataPacket)[]>(
    'SELECT `userId`, CAST(SUM(`attendedSeconds`) AS UNSIGNED) AS `seconds`, MIN(`joinedAt`) AS `firstJoin`, ' +
      'MAX(COALESCE(`leftAt`, `joinedAt`)) AS `lastSeen` ' +
      "FROM `SessionParticipant` WHERE `sessionId` = :sessionId AND `roleAtJoin` = 'student' " +
      'GROUP BY `userId` ORDER BY `seconds` DESC',
    { sessionId },
  );
  return rows.map((r) => ({ ...r, seconds: Number(r.seconds) }));
}

// --- Chat ---

export type ChatMessageRow = {
  id: string;
  sessionId: string;
  authorUserId: string;
  authorName: string;
  body: string;
  createdAt: Date;
};

export async function insertMessage(input: {
  sessionId: string;
  authorUserId: string;
  authorName: string;
  body: string;
}): Promise<ChatMessageRow> {
  const id = createId();
  await db.execute<ResultSetHeader>(
    'INSERT INTO `ChatMessage` (`id`, `sessionId`, `authorUserId`, `authorName`, `body`) VALUES (:id, :sessionId, :authorUserId, :authorName, :body)',
    { id, sessionId: input.sessionId, authorUserId: input.authorUserId, authorName: input.authorName, body: input.body },
  );
  const [rows] = await db.execute<(ChatMessageRow & RowDataPacket)[]>(
    'SELECT `id`, `sessionId`, `authorUserId`, `authorName`, `body`, `createdAt` FROM `ChatMessage` WHERE `id` = :id LIMIT 1',
    { id },
  );
  return rows[0]!;
}

export async function listMessages(sessionId: string, limit = 100): Promise<ChatMessageRow[]> {
  // Take the most recent N, then return in chronological order.
  const [rows] = await db.query<(ChatMessageRow & RowDataPacket)[]>(
    'SELECT * FROM (SELECT `id`, `sessionId`, `authorUserId`, `authorName`, `body`, `createdAt` FROM `ChatMessage` ' +
      'WHERE `sessionId` = ? ORDER BY `createdAt` DESC LIMIT ?) AS recent ORDER BY `createdAt` ASC',
    [sessionId, limit],
  );
  return rows;
}

export async function countMessages(sessionId: string): Promise<number> {
  const [rows] = await db.execute<({ n: number } & RowDataPacket)[]>(
    'SELECT COUNT(*) AS `n` FROM `ChatMessage` WHERE `sessionId` = :sessionId',
    { sessionId },
  );
  return Number(rows[0]?.n ?? 0);
}

// --- Users (display names) ---

export async function findUserById(userId: string): Promise<{ name: string; role: string } | null> {
  const [rows] = await db.execute<({ name: string; role: string } & RowDataPacket)[]>(
    'SELECT `name`, `role` FROM `User` WHERE `id` = :userId LIMIT 1',
    { userId },
  );
  return rows[0] ?? null;
}

export async function findUserNames(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const [rows] = await db.query<({ id: string; name: string } & RowDataPacket)[]>(
    'SELECT `id`, `name` FROM `User` WHERE `id` IN (?)',
    [userIds],
  );
  return new Map(rows.map((r) => [r.id, r.name]));
}
