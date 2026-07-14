import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db, type SqlParams } from '../../db.js';
import { createId } from '../../core/id.js';

/**
 * Data access for the mentorship feature: mentor profiles, availability slots,
 * 1:1 bookings, async doubt threads/messages, and the AI match cache. No FK
 * constraints — related ids are plain columns (per project convention).
 */

// --- Row types ---

export type MentorProfileRow = {
  id: string;
  userId: string;
  headline: string | null;
  bio: string | null;
  expertise: unknown;
  techStack: unknown;
  yearsExperience: number | null;
  timezone: string;
  accepting: 0 | 1 | boolean;
  sessionPriceCents: number;
  feedbackPrompt: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SlotRow = {
  id: string;
  mentorId: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  kind: string;
  access: string;
  capacity: number;
  seatsTaken: number;
  livekitRoom: string | null;
  createdAt: Date;
};

export type BookingRow = {
  id: string;
  slotId: string;
  mentorId: string;
  studentId: string;
  topic: string;
  note: string | null;
  status: string;
  priceCents: number;
  joinCode: string | null;
  feedbackScore: number | null;
  feedbackComment: string | null;
  feedbackAt: Date | null;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
  /** From the joined slot — the session kind + billing access. */
  slotKind: string;
  slotAccess: string;
};

export type ThreadRow = {
  id: string;
  mentorId: string;
  studentId: string;
  lastMessageAt: Date | null;
  createdAt: Date;
};

export type MessageRow = {
  id: string;
  threadId: string;
  authorUserId: string;
  body: string;
  createdAt: Date;
};

/** Coerce a JSON column (string or already-parsed) into a string array. */
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

// --- Users ---

/**
 * A user's effective role is their RBAC `roleId` when set, else the legacy `role`
 * column. Mentors are designated via RBAC, so `roleId = 'mentor'` is the real
 * signal — the legacy `role` is often still 'student' for an assigned mentor.
 */
const EFFECTIVE_ROLE = "COALESCE(NULLIF(`roleId`, ''), `role`)";

export async function listMentorUserIds(): Promise<{ id: string; name: string }[]> {
  const [rows] = await db.execute<({ id: string; name: string } & RowDataPacket)[]>(
    `SELECT \`id\`, \`name\` FROM \`User\` WHERE ${EFFECTIVE_ROLE} = 'mentor' AND \`status\` = 'active' ORDER BY \`name\` ASC`,
  );
  return rows;
}

export async function findUserById(
  userId: string,
): Promise<{ id: string; name: string; role: string } | null> {
  const [rows] = await db.execute<({ id: string; name: string; role: string } & RowDataPacket)[]>(
    `SELECT \`id\`, \`name\`, ${EFFECTIVE_ROLE} AS \`role\` FROM \`User\` WHERE \`id\` = :userId LIMIT 1`,
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

/** Avatar lives on the generic profile table (StudentProfile) for every user. */
export async function findAvatars(userIds: string[]): Promise<Map<string, string | null>> {
  if (userIds.length === 0) return new Map();
  const [rows] = await db.query<({ userId: string; avatarUrl: string | null } & RowDataPacket)[]>(
    'SELECT `userId`, `avatarUrl` FROM `StudentProfile` WHERE `userId` IN (?)',
    [userIds],
  );
  return new Map(rows.map((r) => [r.userId, r.avatarUrl]));
}

/** The requesting student's own profile signals used for AI matching. */
export async function findStudentSignals(
  userId: string,
): Promise<{ techStack: string[]; targetRoles: string[]; goal: string | null; bio: string | null } | null> {
  const [rows] = await db.execute<
    ({ techStack: unknown; targetRoles: unknown; goal: string | null; bio: string | null } & RowDataPacket)[]
  >('SELECT `techStack`, `targetRoles`, `goal`, `bio` FROM `StudentProfile` WHERE `userId` = :userId LIMIT 1', {
    userId,
  });
  const row = rows[0];
  if (!row) return null;
  return {
    techStack: jsonStringArray(row.techStack),
    targetRoles: jsonStringArray(row.targetRoles),
    goal: row.goal ?? null,
    bio: row.bio ?? null,
  };
}

// --- Mentor profile ---

const PROFILE_COLS =
  '`id`, `userId`, `headline`, `bio`, `expertise`, `techStack`, `yearsExperience`, `timezone`, `accepting`, `sessionPriceCents`, `feedbackPrompt`, `createdAt`, `updatedAt`';

export async function findProfile(userId: string): Promise<MentorProfileRow | null> {
  const [rows] = await db.execute<(MentorProfileRow & RowDataPacket)[]>(
    `SELECT ${PROFILE_COLS} FROM \`MentorProfile\` WHERE \`userId\` = :userId LIMIT 1`,
    { userId },
  );
  return rows[0] ?? null;
}

export async function findProfiles(userIds: string[]): Promise<Map<string, MentorProfileRow>> {
  if (userIds.length === 0) return new Map();
  const [rows] = await db.query<(MentorProfileRow & RowDataPacket)[]>(
    `SELECT ${PROFILE_COLS} FROM \`MentorProfile\` WHERE \`userId\` IN (?)`,
    [userIds],
  );
  return new Map(rows.map((r) => [r.userId, r]));
}

export async function upsertProfile(
  userId: string,
  fields: {
    headline?: string;
    bio?: string;
    expertise?: string[];
    techStack?: string[];
    yearsExperience?: number | null;
    timezone?: string;
    accepting?: boolean;
    sessionPriceCents?: number;
    feedbackPrompt?: string;
  },
): Promise<MentorProfileRow> {
  const existing = await findProfile(userId);
  if (!existing) {
    const id = createId();
    await db.execute<ResultSetHeader>(
      'INSERT INTO `MentorProfile` (`id`, `userId`, `headline`, `bio`, `expertise`, `techStack`, `yearsExperience`, `timezone`, `accepting`, `sessionPriceCents`, `feedbackPrompt`) ' +
        'VALUES (:id, :userId, :headline, :bio, :expertise, :techStack, :yearsExperience, :timezone, :accepting, :sessionPriceCents, :feedbackPrompt)',
      {
        id,
        userId,
        headline: fields.headline ?? null,
        bio: fields.bio ?? null,
        expertise: JSON.stringify(fields.expertise ?? []),
        techStack: JSON.stringify(fields.techStack ?? []),
        yearsExperience: fields.yearsExperience ?? null,
        timezone: fields.timezone ?? 'Asia/Kolkata',
        accepting: fields.accepting ?? true,
        sessionPriceCents: fields.sessionPriceCents ?? 0,
        feedbackPrompt: fields.feedbackPrompt ?? null,
      },
    );
    const created = await findProfile(userId);
    if (!created) throw new Error('failed to read back created mentor profile');
    return created;
  }

  // Patch only provided fields.
  const sets: string[] = [];
  const params: SqlParams = { userId };
  if (fields.headline !== undefined) { sets.push('`headline` = :headline'); params.headline = fields.headline; }
  if (fields.bio !== undefined) { sets.push('`bio` = :bio'); params.bio = fields.bio; }
  if (fields.expertise !== undefined) { sets.push('`expertise` = :expertise'); params.expertise = JSON.stringify(fields.expertise); }
  if (fields.techStack !== undefined) { sets.push('`techStack` = :techStack'); params.techStack = JSON.stringify(fields.techStack); }
  if (fields.yearsExperience !== undefined) { sets.push('`yearsExperience` = :yearsExperience'); params.yearsExperience = fields.yearsExperience; }
  if (fields.timezone !== undefined) { sets.push('`timezone` = :timezone'); params.timezone = fields.timezone; }
  if (fields.accepting !== undefined) { sets.push('`accepting` = :accepting'); params.accepting = fields.accepting; }
  if (fields.sessionPriceCents !== undefined) { sets.push('`sessionPriceCents` = :sessionPriceCents'); params.sessionPriceCents = fields.sessionPriceCents; }
  if (fields.feedbackPrompt !== undefined) { sets.push('`feedbackPrompt` = :feedbackPrompt'); params.feedbackPrompt = fields.feedbackPrompt; }

  if (sets.length > 0) {
    await db.execute<ResultSetHeader>(
      `UPDATE \`MentorProfile\` SET ${sets.join(', ')} WHERE \`userId\` = :userId`,
      params,
    );
  }
  const updated = await findProfile(userId);
  if (!updated) throw new Error('failed to read back updated mentor profile');
  return updated;
}

// --- Availability slots ---

const SLOT_COLS =
  '`id`, `mentorId`, `startsAt`, `endsAt`, `status`, `kind`, `access`, `capacity`, `seatsTaken`, `livekitRoom`, `createdAt`';

export async function createSlot(input: {
  mentorId: string;
  startsAt: Date;
  endsAt: Date;
  kind: string;
  access: string;
  capacity: number;
}): Promise<SlotRow> {
  const id = createId();
  await db.execute<ResultSetHeader>(
    'INSERT INTO `MentorAvailabilitySlot` (`id`, `mentorId`, `startsAt`, `endsAt`, `kind`, `access`, `capacity`) ' +
      'VALUES (:id, :mentorId, :startsAt, :endsAt, :kind, :access, :capacity)',
    { id, mentorId: input.mentorId, startsAt: input.startsAt, endsAt: input.endsAt, kind: input.kind, access: input.access, capacity: input.capacity },
  );
  const created = await findSlotById(id);
  if (!created) throw new Error('failed to read back created slot');
  return created;
}

export async function setSlotRoom(id: string, room: string): Promise<void> {
  await db.execute<ResultSetHeader>('UPDATE `MentorAvailabilitySlot` SET `livekitRoom` = :room WHERE `id` = :id', {
    id,
    room,
  });
}

export async function findSlotById(id: string): Promise<SlotRow | null> {
  const [rows] = await db.execute<(SlotRow & RowDataPacket)[]>(
    `SELECT ${SLOT_COLS} FROM \`MentorAvailabilitySlot\` WHERE \`id\` = :id LIMIT 1`,
    { id },
  );
  return rows[0] ?? null;
}

/** Slots for one mentor. `futureOnly` excludes past slots; `openOnly` excludes booked/cancelled. */
export async function listSlotsByMentor(
  mentorId: string,
  opts: { futureOnly?: boolean; openOnly?: boolean } = {},
): Promise<SlotRow[]> {
  const where = ['`mentorId` = :mentorId'];
  if (opts.futureOnly) where.push('`endsAt` > NOW(3)');
  if (opts.openOnly) where.push("`status` = 'open'");
  const [rows] = await db.execute<(SlotRow & RowDataPacket)[]>(
    `SELECT ${SLOT_COLS} FROM \`MentorAvailabilitySlot\` WHERE ${where.join(' AND ')} ORDER BY \`startsAt\` ASC`,
    { mentorId },
  );
  return rows;
}

/** Open future slot counts per mentor — for the directory cards. */
export async function countOpenFutureSlots(mentorIds: string[]): Promise<Map<string, number>> {
  if (mentorIds.length === 0) return new Map();
  const [rows] = await db.query<({ mentorId: string; n: number } & RowDataPacket)[]>(
    "SELECT `mentorId`, COUNT(*) AS n FROM `MentorAvailabilitySlot` " +
      "WHERE `status` = 'open' AND `endsAt` > NOW(3) AND `mentorId` IN (?) GROUP BY `mentorId`",
    [mentorIds],
  );
  return new Map(rows.map((r) => [r.mentorId, Number(r.n)]));
}

export async function setSlotStatus(id: string, status: 'open' | 'booked' | 'cancelled'): Promise<void> {
  await db.execute<ResultSetHeader>('UPDATE `MentorAvailabilitySlot` SET `status` = :status WHERE `id` = :id', {
    id,
    status,
  });
}

/**
 * Atomically claim one seat on an open slot. Works for both 1:1 (capacity 1) and
 * group: increments seatsTaken while a seat is free and flips status to 'booked'
 * once full. Returns true if THIS call won a seat.
 */
export async function claimSeat(id: string): Promise<boolean> {
  const [res] = await db.execute<ResultSetHeader>(
    'UPDATE `MentorAvailabilitySlot` SET `seatsTaken` = `seatsTaken` + 1, ' +
      "`status` = CASE WHEN `seatsTaken` + 1 >= `capacity` THEN 'booked' ELSE `status` END " +
      "WHERE `id` = :id AND `status` = 'open' AND `seatsTaken` < `capacity`",
    { id },
  );
  return res.affectedRows === 1;
}

/** Release a previously claimed seat (on reject/cancel) and re-open the slot. */
export async function releaseSeat(id: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    "UPDATE `MentorAvailabilitySlot` SET `seatsTaken` = GREATEST(0, `seatsTaken` - 1), `status` = 'open' WHERE `id` = :id",
    { id },
  );
}

// --- Bookings ---

export type OpenSessionRow = {
  id: string;
  mentorId: string;
  startsAt: Date;
  endsAt: Date;
  kind: string;
  access: string;
  capacity: number;
  seatsTaken: number;
  mentorName: string;
  headline: string | null;
  sessionPriceCents: number | null;
  avatarUrl: string | null;
};

/** Every open, future, bookable slot across all active mentors — for the browse list. */
export async function listOpenSessions(): Promise<OpenSessionRow[]> {
  const [rows] = await db.execute<(OpenSessionRow & RowDataPacket)[]>(
    'SELECT s.`id`, s.`mentorId`, s.`startsAt`, s.`endsAt`, s.`kind`, s.`access`, s.`capacity`, s.`seatsTaken`, ' +
      'u.`name` AS `mentorName`, p.`headline` AS `headline`, p.`sessionPriceCents` AS `sessionPriceCents`, sp.`avatarUrl` AS `avatarUrl` ' +
      'FROM `MentorAvailabilitySlot` s ' +
      'JOIN `User` u ON u.`id` = s.`mentorId` ' +
      'LEFT JOIN `MentorProfile` p ON p.`userId` = s.`mentorId` ' +
      'LEFT JOIN `StudentProfile` sp ON sp.`userId` = s.`mentorId` ' +
      "WHERE s.`status` = 'open' AND s.`endsAt` > NOW(3) AND u.`status` = 'active' " +
      "AND COALESCE(NULLIF(u.`roleId`, ''), u.`role`) = 'mentor' " +
      'ORDER BY s.`startsAt` ASC',
  );
  return rows;
}

// Bookings carry the slot's `kind` via a LEFT JOIN so views know 1:1 vs group.
const BOOKING_SELECT =
  'SELECT b.`id`, b.`slotId`, b.`mentorId`, b.`studentId`, b.`topic`, b.`note`, b.`status`, ' +
  'b.`priceCents`, b.`joinCode`, b.`feedbackScore`, b.`feedbackComment`, b.`feedbackAt`, ' +
  "b.`startsAt`, b.`endsAt`, b.`createdAt`, COALESCE(s.`kind`, 'one_to_one') AS `slotKind`, " +
  "COALESCE(s.`access`, 'paid') AS `slotAccess` " +
  'FROM `MentorBooking` b LEFT JOIN `MentorAvailabilitySlot` s ON b.`slotId` = s.`id`';

export async function createBooking(input: {
  slotId: string;
  mentorId: string;
  studentId: string;
  topic: string;
  note: string | null;
  priceCents: number;
  status: string;
  startsAt: Date;
  endsAt: Date;
}): Promise<BookingRow> {
  const id = createId();
  await db.execute<ResultSetHeader>(
    'INSERT INTO `MentorBooking` (`id`, `slotId`, `mentorId`, `studentId`, `topic`, `note`, `priceCents`, `status`, `startsAt`, `endsAt`) ' +
      'VALUES (:id, :slotId, :mentorId, :studentId, :topic, :note, :priceCents, :status, :startsAt, :endsAt)',
    { id, ...input },
  );
  const created = await findBookingById(id);
  if (!created) throw new Error('failed to read back created booking');
  return created;
}

export async function findBookingById(id: string): Promise<BookingRow | null> {
  const [rows] = await db.execute<(BookingRow & RowDataPacket)[]>(
    `${BOOKING_SELECT} WHERE b.\`id\` = :id LIMIT 1`,
    { id },
  );
  return rows[0] ?? null;
}

export async function findBookingBySlotAndStudent(slotId: string, studentId: string): Promise<BookingRow | null> {
  const [rows] = await db.execute<(BookingRow & RowDataPacket)[]>(
    `${BOOKING_SELECT} WHERE b.\`slotId\` = :slotId AND b.\`studentId\` = :studentId LIMIT 1`,
    { slotId, studentId },
  );
  return rows[0] ?? null;
}

export async function findBookingByCode(code: string): Promise<BookingRow | null> {
  const [rows] = await db.execute<(BookingRow & RowDataPacket)[]>(
    `${BOOKING_SELECT} WHERE b.\`joinCode\` = :code LIMIT 1`,
    { code },
  );
  return rows[0] ?? null;
}

export async function listBookingsByStudent(studentId: string): Promise<BookingRow[]> {
  const [rows] = await db.execute<(BookingRow & RowDataPacket)[]>(
    `${BOOKING_SELECT} WHERE b.\`studentId\` = :studentId ORDER BY b.\`startsAt\` DESC`,
    { studentId },
  );
  return rows;
}

export async function listBookingsByMentor(mentorId: string): Promise<BookingRow[]> {
  const [rows] = await db.execute<(BookingRow & RowDataPacket)[]>(
    `${BOOKING_SELECT} WHERE b.\`mentorId\` = :mentorId ORDER BY b.\`startsAt\` DESC`,
    { mentorId },
  );
  return rows;
}

export async function setBookingStatus(
  id: string,
  status: 'pending_payment' | 'confirmed' | 'cancelled' | 'completed' | 'rejected',
): Promise<void> {
  await db.execute<ResultSetHeader>('UPDATE `MentorBooking` SET `status` = :status WHERE `id` = :id', {
    id,
    status,
  });
}

export async function setBookingJoinCode(id: string, joinCode: string): Promise<void> {
  await db.execute<ResultSetHeader>('UPDATE `MentorBooking` SET `joinCode` = :joinCode WHERE `id` = :id', {
    id,
    joinCode,
  });
}

export async function setBookingFeedback(
  id: string,
  score: number,
  comment: string | null,
): Promise<void> {
  await db.execute<ResultSetHeader>(
    "UPDATE `MentorBooking` SET `feedbackScore` = :score, `feedbackComment` = :comment, `feedbackAt` = NOW(3), `status` = 'completed' WHERE `id` = :id",
    { id, score, comment },
  );
}

// --- Threads & messages (async doubts) ---

const THREAD_COLS = '`id`, `mentorId`, `studentId`, `lastMessageAt`, `createdAt`';

export async function findThread(mentorId: string, studentId: string): Promise<ThreadRow | null> {
  const [rows] = await db.execute<(ThreadRow & RowDataPacket)[]>(
    `SELECT ${THREAD_COLS} FROM \`MentorThread\` WHERE \`mentorId\` = :mentorId AND \`studentId\` = :studentId LIMIT 1`,
    { mentorId, studentId },
  );
  return rows[0] ?? null;
}

export async function findThreadById(id: string): Promise<ThreadRow | null> {
  const [rows] = await db.execute<(ThreadRow & RowDataPacket)[]>(
    `SELECT ${THREAD_COLS} FROM \`MentorThread\` WHERE \`id\` = :id LIMIT 1`,
    { id },
  );
  return rows[0] ?? null;
}

export async function getOrCreateThread(mentorId: string, studentId: string): Promise<ThreadRow> {
  const existing = await findThread(mentorId, studentId);
  if (existing) return existing;
  const id = createId();
  try {
    await db.execute<ResultSetHeader>(
      'INSERT INTO `MentorThread` (`id`, `mentorId`, `studentId`) VALUES (:id, :mentorId, :studentId)',
      { id, mentorId, studentId },
    );
  } catch {
    // Lost a race on the (mentorId, studentId) unique index — re-read the winner.
    const raced = await findThread(mentorId, studentId);
    if (raced) return raced;
    throw new Error('failed to create mentor thread');
  }
  const created = await findThreadById(id);
  if (!created) throw new Error('failed to read back created thread');
  return created;
}

export async function listThreadsByMentor(mentorId: string): Promise<ThreadRow[]> {
  const [rows] = await db.execute<(ThreadRow & RowDataPacket)[]>(
    `SELECT ${THREAD_COLS} FROM \`MentorThread\` WHERE \`mentorId\` = :mentorId ORDER BY COALESCE(\`lastMessageAt\`, \`createdAt\`) DESC`,
    { mentorId },
  );
  return rows;
}

export async function listThreadsByStudent(studentId: string): Promise<ThreadRow[]> {
  const [rows] = await db.execute<(ThreadRow & RowDataPacket)[]>(
    `SELECT ${THREAD_COLS} FROM \`MentorThread\` WHERE \`studentId\` = :studentId ORDER BY COALESCE(\`lastMessageAt\`, \`createdAt\`) DESC`,
    { studentId },
  );
  return rows;
}

export async function insertMessage(input: {
  threadId: string;
  authorUserId: string;
  body: string;
}): Promise<MessageRow> {
  const id = createId();
  await db.execute<ResultSetHeader>(
    'INSERT INTO `MentorMessage` (`id`, `threadId`, `authorUserId`, `body`) VALUES (:id, :threadId, :authorUserId, :body)',
    { id, threadId: input.threadId, authorUserId: input.authorUserId, body: input.body },
  );
  await db.execute<ResultSetHeader>('UPDATE `MentorThread` SET `lastMessageAt` = NOW(3) WHERE `id` = :id', {
    id: input.threadId,
  });
  const [rows] = await db.execute<(MessageRow & RowDataPacket)[]>(
    'SELECT `id`, `threadId`, `authorUserId`, `body`, `createdAt` FROM `MentorMessage` WHERE `id` = :id LIMIT 1',
    { id },
  );
  if (!rows[0]) throw new Error('failed to read back created message');
  return rows[0];
}

export async function listMessages(threadId: string, limit = 200): Promise<MessageRow[]> {
  const [rows] = await db.execute<(MessageRow & RowDataPacket)[]>(
    'SELECT `id`, `threadId`, `authorUserId`, `body`, `createdAt` FROM `MentorMessage` ' +
      `WHERE \`threadId\` = :threadId ORDER BY \`createdAt\` ASC LIMIT ${Math.trunc(limit)}`,
    { threadId },
  );
  return rows;
}

/** Latest message body per thread — for thread-list previews. */
export async function latestMessagePreviews(threadIds: string[]): Promise<Map<string, string>> {
  if (threadIds.length === 0) return new Map();
  const [rows] = await db.query<({ threadId: string; body: string } & RowDataPacket)[]>(
    'SELECT m.`threadId`, m.`body` FROM `MentorMessage` m ' +
      'INNER JOIN (SELECT `threadId`, MAX(`createdAt`) AS mx FROM `MentorMessage` WHERE `threadId` IN (?) GROUP BY `threadId`) t ' +
      'ON m.`threadId` = t.`threadId` AND m.`createdAt` = t.mx',
    [threadIds],
  );
  return new Map(rows.map((r) => [r.threadId, r.body]));
}

// --- Mentor impact stats (details page) ---

/** Booking counts by lifecycle for one mentor, in a single pass. */
export async function countBookingStats(
  mentorId: string,
): Promise<{ total: number; completed: number; confirmed: number; cancelled: number }> {
  const [rows] = await db.execute<
    ({ total: number; completed: number; confirmed: number; cancelled: number } & RowDataPacket)[]
  >(
    'SELECT COUNT(*) AS total, ' +
      "SUM(`status` = 'completed') AS completed, " +
      "SUM(`status` = 'confirmed') AS confirmed, " +
      "SUM(`status` IN ('cancelled', 'rejected')) AS cancelled " +
      'FROM `MentorBooking` WHERE `mentorId` = :mentorId',
    { mentorId },
  );
  const r = rows[0];
  return {
    total: Number(r?.total ?? 0),
    completed: Number(r?.completed ?? 0),
    confirmed: Number(r?.confirmed ?? 0),
    cancelled: Number(r?.cancelled ?? 0),
  };
}

/** Distinct students who ever booked a session OR opened a doubt thread with the mentor. */
export async function countDistinctStudents(mentorId: string): Promise<number> {
  const [rows] = await db.execute<({ n: number } & RowDataPacket)[]>(
    'SELECT COUNT(*) AS n FROM (' +
      'SELECT `studentId` FROM `MentorBooking` WHERE `mentorId` = :mentorId ' +
      'UNION SELECT `studentId` FROM `MentorThread` WHERE `mentorId` = :mentorId' +
      ') t',
    { mentorId },
  );
  return Number(rows[0]?.n ?? 0);
}

/** Number of async doubt threads addressed to this mentor. */
export async function countThreads(mentorId: string): Promise<number> {
  const [rows] = await db.execute<({ n: number } & RowDataPacket)[]>(
    'SELECT COUNT(*) AS n FROM `MentorThread` WHERE `mentorId` = :mentorId',
    { mentorId },
  );
  return Number(rows[0]?.n ?? 0);
}

/** Doubt messages students have sent this mentor (excludes the mentor's own replies). */
export async function countStudentDoubtMessages(mentorId: string): Promise<number> {
  const [rows] = await db.execute<({ n: number } & RowDataPacket)[]>(
    'SELECT COUNT(*) AS n FROM `MentorMessage` m ' +
      'JOIN `MentorThread` t ON t.`id` = m.`threadId` ' +
      'WHERE t.`mentorId` = :mentorId AND m.`authorUserId` <> :mentorId',
    { mentorId },
  );
  return Number(rows[0]?.n ?? 0);
}

/** Average rating, count, and the per-star distribution (index 0 = ★1 … 4 = ★5). */
export async function ratingStats(
  mentorId: string,
): Promise<{ avg: number | null; count: number; distribution: [number, number, number, number, number] }> {
  const [rows] = await db.execute<({ score: number; n: number } & RowDataPacket)[]>(
    'SELECT `feedbackScore` AS score, COUNT(*) AS n FROM `MentorBooking` ' +
      'WHERE `mentorId` = :mentorId AND `feedbackScore` IS NOT NULL GROUP BY `feedbackScore`',
    { mentorId },
  );
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let weighted = 0;
  let count = 0;
  for (const row of rows) {
    const score = Number(row.score);
    const n = Number(row.n);
    if (score >= 1 && score <= 5) {
      distribution[score - 1] = n;
      weighted += score * n;
      count += n;
    }
  }
  return { avg: count > 0 ? weighted / count : null, count, distribution };
}

/** Live broadcast sessions this mentor has run to completion. */
export async function countLiveSessions(mentorId: string): Promise<number> {
  const [rows] = await db.execute<({ n: number } & RowDataPacket)[]>(
    "SELECT COUNT(*) AS n FROM `LiveSession` WHERE `mentorId` = :mentorId AND `status` = 'ended'",
    { mentorId },
  );
  return Number(rows[0]?.n ?? 0);
}

// --- AI match cache ---

export async function findMatchCache(
  studentId: string,
): Promise<{ result: unknown; generatedAt: Date } | null> {
  const [rows] = await db.execute<({ result: unknown; generatedAt: Date } & RowDataPacket)[]>(
    'SELECT `result`, `generatedAt` FROM `MentorMatchCache` WHERE `studentId` = :studentId LIMIT 1',
    { studentId },
  );
  return rows[0] ?? null;
}

export async function upsertMatchCache(studentId: string, result: unknown): Promise<void> {
  const existing = await findMatchCache(studentId);
  const payload = JSON.stringify(result);
  if (existing) {
    await db.execute<ResultSetHeader>(
      'UPDATE `MentorMatchCache` SET `result` = :result, `generatedAt` = NOW(3) WHERE `studentId` = :studentId',
      { result: payload, studentId },
    );
  } else {
    await db.execute<ResultSetHeader>(
      'INSERT INTO `MentorMatchCache` (`id`, `studentId`, `result`) VALUES (:id, :studentId, :result)',
      { id: createId(), studentId, result: payload },
    );
  }
}
