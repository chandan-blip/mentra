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
  /** 'live' (recorded broadcast) or 'upload' (mentor-uploaded video). */
  source: 'live' | 'upload';
  /** Recording lifecycle: null → recording → processing → ready | failed. */
  recordingStatus: 'recording' | 'processing' | 'ready' | 'failed' | null;
  /** Public CDN URL of the HLS master playlist, set when status = 'ready'. */
  recordingUrl: string | null;
  /** Public URL of the AI-designed cover image (thumbnails/<id>.png in R2), or null. */
  thumbnailUrl: string | null;
  /** Managed in the Videos module — false hides the video from student feeds/watch pages. */
  visible: boolean;
  /** Public videos are watchable by anyone (even logged-out) at /watch/:id. */
  isPublic: boolean;
  /** LiveKit egress id of the in-flight/completed composite recording. */
  egressId: string | null;
  /** Playback duration in seconds (ffprobe), filled by the transcode worker. */
  durationSeconds: number | null;
  createdAt: Date;
};

const COLS =
  '`id`, `mentorId`, `title`, `topic`, `status`, `scheduledFor`, `startedAt`, `endedAt`, `livekitRoom`, `currentViewers`, `peakViewers`, `source`, `recordingStatus`, `recordingUrl`, `thumbnailUrl`, `visible`, `isPublic`, `egressId`, `durationSeconds`, `createdAt`';

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
    `SELECT ${COLS} FROM \`LiveSession\` WHERE \`status\` = 'live' AND \`visible\` = 1 ORDER BY \`startedAt\` DESC`,
  );
  return rows;
}

export async function listUpcoming(): Promise<LiveSessionRow[]> {
  // Every scheduled (visible) session is "upcoming" until the mentor starts it (→ live) or
  // cancels it — we do NOT drop sessions whose scheduled time has merely passed, otherwise
  // a session scheduled for earlier today disappears before it's ever run. Undated (NULL)
  // sessions sort last. Ordered soonest-first.
  const [rows] = await db.execute<(LiveSessionRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`LiveSession\` WHERE \`status\` = 'scheduled' AND \`visible\` = 1 ORDER BY \`scheduledFor\` IS NULL, \`scheduledFor\` ASC`,
  );
  return rows;
}

export async function listPast(limit = 50): Promise<LiveSessionRow[]> {
  const [rows] = await db.query<(LiveSessionRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`LiveSession\` WHERE \`status\` = 'ended' AND \`visible\` = 1 ORDER BY \`endedAt\` DESC LIMIT ?`,
    [limit],
  );
  return rows;
}

export type AttendedSessionRow = LiveSessionRow & { attendedSeconds: number; attendedAt: Date };

/**
 * Live sessions the given student actually joined (attended), most-recent join first.
 * Aggregates a student's participation rows (they may join/leave more than once) per session.
 * Grouped by the session PK so ONLY_FULL_GROUP_BY is satisfied for the selected session columns.
 */
export async function listAttendedByUser(userId: string, limit = 50): Promise<AttendedSessionRow[]> {
  const cols = COLS.replace(/`(\w+)`/g, 's.`$1`');
  const [rows] = await db.query<(AttendedSessionRow & RowDataPacket)[]>(
    `SELECT ${cols}, CAST(SUM(p.\`attendedSeconds\`) AS UNSIGNED) AS \`attendedSeconds\`, MAX(p.\`joinedAt\`) AS \`attendedAt\`
       FROM \`SessionParticipant\` p JOIN \`LiveSession\` s ON s.\`id\` = p.\`sessionId\`
      WHERE p.\`userId\` = ? AND p.\`roleAtJoin\` = 'student'
      GROUP BY s.\`id\`
      ORDER BY \`attendedAt\` DESC
      LIMIT ?`,
    [userId, limit],
  );
  return rows;
}

// --- Videos management (role-gated 'manage-videos' module) ---

/**
 * ALL sessions for the management surface — scheduled, live, ended, and uploads alike (not
 * just ones with a recording). Ignores `visible` (managers see hidden ones too). Optional
 * case-insensitive title/topic search.
 */
export async function listManagedVideos(search?: string, limit = 200): Promise<LiveSessionRow[]> {
  if (search && search.trim()) {
    const like = `%${search.trim()}%`;
    const [rows] = await db.query<(LiveSessionRow & RowDataPacket)[]>(
      `SELECT ${COLS} FROM \`LiveSession\` WHERE (\`title\` LIKE ? OR \`topic\` LIKE ?) ORDER BY \`createdAt\` DESC LIMIT ?`,
      [like, like, limit],
    );
    return rows;
  }
  const [rows] = await db.query<(LiveSessionRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`LiveSession\` ORDER BY \`createdAt\` DESC LIMIT ?`,
    [limit],
  );
  return rows;
}

/** Toggle a video's visibility to students. */
export async function setVisible(id: string, visible: boolean): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `LiveSession` SET `visible` = :visible WHERE `id` = :id',
    { id, visible: visible ? 1 : 0 },
  );
}

/** Toggle whether a video is publicly watchable (logged-out) at /watch/:id. */
export async function setPublic(id: string, isPublic: boolean): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `LiveSession` SET `isPublic` = :isPublic WHERE `id` = :id',
    { id, isPublic: isPublic ? 1 : 0 },
  );
}

/** Edit a video's title/topic (management edit — no status guard). */
export async function setVideoMeta(id: string, fields: { title?: string; topic?: string }): Promise<void> {
  await updateScheduled(id, { title: fields.title, topic: fields.topic });
}

/** Hard-delete a video and its dependent rows (no FKs, so clean them explicitly). */
export async function deleteVideoCascade(id: string): Promise<void> {
  await db.execute<ResultSetHeader>('DELETE FROM `ChatMessage` WHERE `sessionId` = :id', { id });
  await db.execute<ResultSetHeader>('DELETE FROM `WatchProgress` WHERE `sessionId` = :id', { id });
  await db.execute<ResultSetHeader>('DELETE FROM `SessionLike` WHERE `sessionId` = :id', { id });
  await db.execute<ResultSetHeader>('DELETE FROM `SessionParticipant` WHERE `sessionId` = :id', { id });
  await db.execute<ResultSetHeader>('DELETE FROM `LiveSession` WHERE `id` = :id', { id });
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

// --- Mentor upload (video → same HLS pipeline) ---

/**
 * Create a session row for a mentor-uploaded video. It's born 'ended' + source='upload'
 * + recordingStatus='processing' (the worker flips it to 'ready'), with a synthetic
 * livekitRoom so the UNIQUE constraint holds. Returns the created row.
 */
export async function createUpload(input: {
  mentorId: string;
  title: string;
  topic: string;
}): Promise<LiveSessionRow> {
  const id = createId();
  await db.execute<ResultSetHeader>(
    "INSERT INTO `LiveSession` (`id`, `mentorId`, `title`, `topic`, `status`, `livekitRoom`, `source`, `recordingStatus`, `startedAt`, `endedAt`) " +
      "VALUES (:id, :mentorId, :title, :topic, 'ended', :room, 'upload', 'processing', NOW(3), NOW(3))",
    { id, mentorId: input.mentorId, title: input.title, topic: input.topic, room: `up_${id}` },
  );
  const created = await findById(id);
  if (!created) throw new Error('failed to read back created upload');
  return created;
}

export async function setDuration(id: string, seconds: number): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `LiveSession` SET `durationSeconds` = :seconds WHERE `id` = :id',
    { id, seconds },
  );
}

// --- Recording (egress → HLS) ---

export async function findByEgressId(egressId: string): Promise<LiveSessionRow | null> {
  const [rows] = await db.execute<(LiveSessionRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`LiveSession\` WHERE \`egressId\` = :egressId LIMIT 1`,
    { egressId },
  );
  return rows[0] ?? null;
}

/** Record the egress id and mark the session as actively recording. */
export async function setEgress(id: string, egressId: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    "UPDATE `LiveSession` SET `egressId` = :egressId, `recordingStatus` = 'recording' WHERE `id` = :id",
    { id, egressId },
  );
}

/** Update recording status (and the public HLS URL once ready). */
export async function setRecordingStatus(
  id: string,
  status: 'recording' | 'processing' | 'ready' | 'failed',
  url: string | null = null,
): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `LiveSession` SET `recordingStatus` = :status, `recordingUrl` = :url WHERE `id` = :id',
    { id, status, url },
  );
}

/** Store the AI-designed cover URL (thumbnail worker calls this after render + upload). */
export async function setThumbnail(id: string, url: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `LiveSession` SET `thumbnailUrl` = :url WHERE `id` = :id',
    { id, url },
  );
}

/** Most-recent chat comment bodies (chronological), used as extra context for the
 * end-of-session thumbnail. Empty for sessions with no chat (e.g. uploads). */
export async function topComments(sessionId: string, limit = 40): Promise<string[]> {
  const [rows] = await db.query<({ body: string } & RowDataPacket)[]>(
    'SELECT `body` FROM (SELECT `body`, `createdAt` FROM `ChatMessage` ' +
      'WHERE `sessionId` = ? ORDER BY `createdAt` DESC LIMIT ?) AS recent ORDER BY `createdAt` ASC',
    [sessionId, limit],
  );
  return rows.map((r) => r.body);
}

// --- Watch progress (resume) ---

export async function getWatchProgress(userId: string, sessionId: string): Promise<number> {
  const [rows] = await db.execute<({ positionSeconds: number } & RowDataPacket)[]>(
    'SELECT `positionSeconds` FROM `WatchProgress` WHERE `userId` = :userId AND `sessionId` = :sessionId LIMIT 1',
    { userId, sessionId },
  );
  return rows[0]?.positionSeconds ?? 0;
}

/** Upsert the resume position (unique on userId+sessionId). */
export async function upsertWatchProgress(
  userId: string,
  sessionId: string,
  positionSeconds: number,
): Promise<void> {
  await db.execute<ResultSetHeader>(
    'INSERT INTO `WatchProgress` (`id`, `userId`, `sessionId`, `positionSeconds`) ' +
      'VALUES (:id, :userId, :sessionId, :pos) ' +
      'ON DUPLICATE KEY UPDATE `positionSeconds` = :pos, `updatedAt` = NOW(3)',
    { id: createId(), userId, sessionId, pos: positionSeconds },
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

/** Bulk-insert buffered chat messages (one round-trip). Used by the batch flusher. */
export async function insertMessages(
  rows: {
    id: string;
    sessionId: string;
    authorUserId: string;
    authorName: string;
    body: string;
    createdAt: Date;
  }[],
): Promise<void> {
  if (rows.length === 0) return;
  const values = rows.map((r) => [r.id, r.sessionId, r.authorUserId, r.authorName, r.body, r.createdAt]);
  await db.query<ResultSetHeader>(
    'INSERT INTO `ChatMessage` (`id`, `sessionId`, `authorUserId`, `authorName`, `body`, `createdAt`) VALUES ?',
    [values],
  );
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

/** Batch chat counts for a set of sessions (the "comments" number on cards). */
export async function countMessagesForSessions(sessionIds: string[]): Promise<Map<string, number>> {
  if (sessionIds.length === 0) return new Map();
  const [rows] = await db.query<({ sessionId: string; n: number } & RowDataPacket)[]>(
    'SELECT `sessionId`, COUNT(*) AS `n` FROM `ChatMessage` WHERE `sessionId` IN (?) GROUP BY `sessionId`',
    [sessionIds],
  );
  return new Map(rows.map((r) => [r.sessionId, Number(r.n)]));
}

/** Batch mentor display cards (name + avatar) for a set of user ids. */
export async function findUserCards(
  userIds: string[],
): Promise<Map<string, { name: string; avatarUrl: string | null }>> {
  if (userIds.length === 0) return new Map();
  const [rows] = await db.query<({ id: string; name: string; avatarUrl: string | null } & RowDataPacket)[]>(
    'SELECT u.`id`, u.`name`, p.`avatarUrl` FROM `User` u ' +
      'LEFT JOIN `StudentProfile` p ON p.`userId` = u.`id` WHERE u.`id` IN (?)',
    [userIds],
  );
  return new Map(rows.map((r) => [r.id, { name: r.name, avatarUrl: r.avatarUrl ?? null }]));
}

// --- Likes (session reactions) ---

/** Idempotently record a like (unique on userId+sessionId — a repeat is a no-op). */
export async function insertLike(sessionId: string, userId: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    'INSERT INTO `SessionLike` (`id`, `sessionId`, `userId`) VALUES (:id, :sessionId, :userId) ' +
      'ON DUPLICATE KEY UPDATE `id` = `id`',
    { id: createId(), sessionId, userId },
  );
}

export async function deleteLike(sessionId: string, userId: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    'DELETE FROM `SessionLike` WHERE `sessionId` = :sessionId AND `userId` = :userId',
    { sessionId, userId },
  );
}

export async function countLikes(sessionId: string): Promise<number> {
  const [rows] = await db.execute<({ n: number } & RowDataPacket)[]>(
    'SELECT COUNT(*) AS `n` FROM `SessionLike` WHERE `sessionId` = :sessionId',
    { sessionId },
  );
  return Number(rows[0]?.n ?? 0);
}

export async function hasLiked(userId: string, sessionId: string): Promise<boolean> {
  const [rows] = await db.execute<(RowDataPacket)[]>(
    'SELECT 1 FROM `SessionLike` WHERE `userId` = :userId AND `sessionId` = :sessionId LIMIT 1',
    { userId, sessionId },
  );
  return rows.length > 0;
}

/** Batch like counts for a set of sessions (the heart count on cards / lists). */
export async function countLikesForSessions(sessionIds: string[]): Promise<Map<string, number>> {
  if (sessionIds.length === 0) return new Map();
  const [rows] = await db.query<({ sessionId: string; n: number } & RowDataPacket)[]>(
    'SELECT `sessionId`, COUNT(*) AS `n` FROM `SessionLike` WHERE `sessionId` IN (?) GROUP BY `sessionId`',
    [sessionIds],
  );
  return new Map(rows.map((r) => [r.sessionId, Number(r.n)]));
}

/** Which of the given sessions the user has already liked (batch, for list views). */
export async function likedSessionIds(userId: string, sessionIds: string[]): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set();
  const [rows] = await db.query<({ sessionId: string } & RowDataPacket)[]>(
    'SELECT `sessionId` FROM `SessionLike` WHERE `userId` = ? AND `sessionId` IN (?)',
    [userId, sessionIds],
  );
  return new Set(rows.map((r) => r.sessionId));
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
