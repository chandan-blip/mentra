import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../../db.js';
import { env } from '../../env.js';
import { createId } from '../../core/id.js';

export type ProfileRow = {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  timezone: string;
  educationLevel: string | null;
  collegeName: string | null;
  graduationYear: number | null;
  experienceLevel: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  goal: string | null;
  preferredCompanyType: string[] | null;
  targetRoles: string[] | null;
  studyHoursPerDay: number | null;
  techStack: string[] | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  twitterUrl: string | null;
  resumeFileKey: string | null;
  resumeUploadedAt: Date | null;
  avatarFileKey: string | null;
  onboardingStep: number;
  onboardingComplete: 0 | 1 | boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PrefsRow = {
  id: string;
  userId: string;
  emailDailyTasks: 0 | 1 | boolean;
  emailWeeklyReview: 0 | 1 | boolean;
  emailSessionReminders: 0 | 1 | boolean;
  emailAnnouncements: 0 | 1 | boolean;
  inAppEnabled: 0 | 1 | boolean;
};

// StudentProfile columns, qualified with the `p` alias — the finder JOINs `User`
// (aliased `u`) for the display name, and several columns (id/userId/createdAt/…)
// exist on both tables, so every reference must be qualified.
const PROFILE_COLUMNS = [
  'id', 'userId', 'avatarUrl', 'bio', 'country', 'city', 'timezone', 'educationLevel',
  'collegeName', 'graduationYear', 'experienceLevel', 'currentRole', 'currentCompany', 'goal',
  'preferredCompanyType', 'targetRoles', 'studyHoursPerDay', 'techStack', 'githubUrl',
  'linkedinUrl', 'portfolioUrl', 'twitterUrl', 'resumeFileKey', 'resumeUploadedAt',
  'avatarFileKey', 'onboardingStep', 'onboardingComplete', 'createdAt', 'updatedAt',
]
  .map((col) => `p.\`${col}\``)
  .join(', ');

/** Columns that hold JSON arrays and must be stringified before binding. */
const JSON_COLUMNS = new Set(['preferredCompanyType', 'targetRoles', 'techStack']);

/** Columns that may be written by a profile update. Acts as a SQL-injection allowlist. */
const WRITABLE_COLUMNS = new Set([
  'avatarUrl',
  'bio',
  'country',
  'city',
  'timezone',
  'educationLevel',
  'collegeName',
  'graduationYear',
  'experienceLevel',
  'currentRole',
  'currentCompany',
  'goal',
  'preferredCompanyType',
  'targetRoles',
  'studyHoursPerDay',
  'techStack',
  'githubUrl',
  'linkedinUrl',
  'portfolioUrl',
  'twitterUrl',
]);

export async function findProfileByUserId(userId: string): Promise<ProfileRow | null> {
  const [rows] = await db.execute<(ProfileRow & RowDataPacket)[]>(
    `SELECT ${PROFILE_COLUMNS}, u.\`name\` AS \`name\` FROM \`StudentProfile\` p ` +
      'JOIN `User` u ON u.`id` = p.`userId` WHERE p.`userId` = :userId LIMIT 1',
    { userId },
  );
  return rows[0] ?? null;
}

export async function createProfile(userId: string): Promise<ProfileRow> {
  await db.execute<ResultSetHeader>(
    'INSERT INTO `StudentProfile` (`id`, `userId`, `timezone`) VALUES (:id, :userId, :timezone)',
    { id: createId(), userId, timezone: env.PROFILE_DEFAULT_TIMEZONE },
  );
  const profile = await findProfileByUserId(userId);
  if (!profile) throw new Error('profile insert did not persist');
  return profile;
}

/** Partial update over the writable allowlist. Returns the refreshed row. */
export async function updateProfileFields(
  userId: string,
  fields: Record<string, unknown>,
): Promise<ProfileRow> {
  const entries = Object.entries(fields).filter(([col]) => WRITABLE_COLUMNS.has(col));

  if (entries.length > 0) {
    const params: Record<string, string | number | boolean | null> = { userId };
    const setClauses = entries.map(([col, value]) => {
      params[col] = (JSON_COLUMNS.has(col) && value != null ? JSON.stringify(value) : value) as
        | string
        | number
        | boolean
        | null;
      return `\`${col}\` = :${col}`;
    });
    await db.execute<ResultSetHeader>(
      `UPDATE \`StudentProfile\` SET ${setClauses.join(', ')} WHERE \`userId\` = :userId`,
      params,
    );
  }

  const profile = await findProfileByUserId(userId);
  if (!profile) throw new Error('profile not found after update');
  return profile;
}

/** Update the display name on the User record (profile name lives there, not on StudentProfile). */
export async function updateUserName(userId: string, name: string): Promise<void> {
  await db.execute<ResultSetHeader>('UPDATE `User` SET `name` = :name WHERE `id` = :userId', {
    userId,
    name,
  });
}

export async function setOnboarding(
  userId: string,
  step: number,
  complete: boolean,
): Promise<void> {
  // onboardingComplete never regresses to false.
  await db.execute<ResultSetHeader>(
    'UPDATE `StudentProfile` SET `onboardingStep` = :step, ' +
      '`onboardingComplete` = (`onboardingComplete` OR :complete) WHERE `userId` = :userId',
    { userId, step, complete },
  );
}

export async function setResume(
  userId: string,
  fileKey: string,
  uploadedAt: Date,
): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `StudentProfile` SET `resumeFileKey` = :fileKey, `resumeUploadedAt` = :uploadedAt WHERE `userId` = :userId',
    { userId, fileKey, uploadedAt },
  );
}

export async function clearResume(userId: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `StudentProfile` SET `resumeFileKey` = NULL, `resumeUploadedAt` = NULL WHERE `userId` = :userId',
    { userId },
  );
}

/** Set the uploaded avatar: the storage key plus the servable URL shown to clients. */
export async function setAvatar(userId: string, fileKey: string, avatarUrl: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `StudentProfile` SET `avatarFileKey` = :fileKey, `avatarUrl` = :avatarUrl WHERE `userId` = :userId',
    { userId, fileKey, avatarUrl },
  );
}

export async function clearAvatar(userId: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `StudentProfile` SET `avatarFileKey` = NULL, `avatarUrl` = NULL WHERE `userId` = :userId',
    { userId },
  );
}

/** Count community posts authored by a user (for the public-profile stat shelf). */
export async function countPostsByAuthor(userId: string): Promise<number> {
  const [rows] = await db.execute<(RowDataPacket & { n: number })[]>(
    'SELECT COUNT(*) AS n FROM `CommunityPost` WHERE `authorId` = :userId',
    { userId },
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Completion % (0–100) of the user's active roadmap, or null if they have none.
 * Inlined here (rather than importing the roadmap module) to keep the profile
 * module self-contained — this is a read-only aggregate over roadmap tables.
 */
export async function activeRoadmapProgress(userId: string): Promise<number | null> {
  const [rows] = await db.execute<(RowDataPacket & { total: number; completed: number })[]>(
    "SELECT COUNT(*) AS total, SUM(i.`status` = 'completed') AS completed " +
      'FROM `RoadmapItem` i JOIN `RoadmapWeek` w ON w.`id` = i.`weekId` ' +
      "JOIN `Roadmap` r ON r.`id` = w.`roadmapId` WHERE r.`userId` = :userId AND r.`status` = 'active'",
    { userId },
  );
  const total = Number(rows[0]?.total ?? 0);
  if (total === 0) return null;
  const completed = Number(rows[0]?.completed ?? 0);
  return Math.round((completed / total) * 100);
}

// --- Social graph (Follow) ---

export type DirectoryRow = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  goal: string | null;
  city: string | null;
  country: string | null;
  techStack: string[] | null;
  followers: number;
  isFollowedByViewer: 0 | 1;
};

/** Create a follow edge (idempotent — the unique index absorbs a repeat follow). */
export async function insertFollow(followerId: string, followeeId: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    'INSERT IGNORE INTO `Follow` (`id`, `followerId`, `followeeId`) VALUES (:id, :followerId, :followeeId)',
    { id: createId(), followerId, followeeId },
  );
}

export async function deleteFollow(followerId: string, followeeId: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    'DELETE FROM `Follow` WHERE `followerId` = :followerId AND `followeeId` = :followeeId',
    { followerId, followeeId },
  );
}

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const [rows] = await db.execute<(RowDataPacket & { n: number })[]>(
    'SELECT COUNT(*) AS n FROM `Follow` WHERE `followerId` = :followerId AND `followeeId` = :followeeId',
    { followerId, followeeId },
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

export async function countFollowers(userId: string): Promise<number> {
  const [rows] = await db.execute<(RowDataPacket & { n: number })[]>(
    'SELECT COUNT(*) AS n FROM `Follow` WHERE `followeeId` = :userId',
    { userId },
  );
  return Number(rows[0]?.n ?? 0);
}

export async function countFollowing(userId: string): Promise<number> {
  const [rows] = await db.execute<(RowDataPacket & { n: number })[]>(
    'SELECT COUNT(*) AS n FROM `Follow` WHERE `followerId` = :userId',
    { userId },
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Browsable student directory: onboarded profiles other than the viewer, with a
 * follower count and whether the viewer already follows them. `q` does a crude
 * LIKE over name + tech stack (the techStack JSON is stored as text).
 */
export async function listDirectory(args: {
  viewerId: string;
  q?: string;
  limit: number;
}): Promise<DirectoryRow[]> {
  const params: Record<string, string | number> = { viewerId: args.viewerId, limit: args.limit };
  let where = 'p.`onboardingComplete` = 1 AND p.`userId` <> :viewerId';
  if (args.q && args.q.trim()) {
    params.q = `%${args.q.trim()}%`;
    where += ' AND (u.`name` LIKE :q OR p.`techStack` LIKE :q OR p.`currentRole` LIKE :q)';
  }
  const [rows] = await db.execute<(DirectoryRow & RowDataPacket)[]>(
    'SELECT p.`userId`, u.`name` AS `name`, p.`avatarUrl`, p.`currentRole`, p.`currentCompany`, ' +
      'p.`goal`, p.`city`, p.`country`, p.`techStack`, ' +
      '(SELECT COUNT(*) FROM `Follow` f WHERE f.`followeeId` = p.`userId`) AS `followers`, ' +
      'EXISTS(SELECT 1 FROM `Follow` f2 WHERE f2.`followeeId` = p.`userId` AND f2.`followerId` = :viewerId) AS `isFollowedByViewer` ' +
      'FROM `StudentProfile` p JOIN `User` u ON u.`id` = p.`userId` ' +
      `WHERE ${where} ` +
      'ORDER BY `followers` DESC, p.`createdAt` DESC ' +
      `LIMIT ${Number(args.limit)}`,
    params,
  );
  return rows;
}

export async function findPrefsByUserId(userId: string): Promise<PrefsRow | null> {
  const [rows] = await db.execute<(PrefsRow & RowDataPacket)[]>(
    'SELECT `id`, `userId`, `emailDailyTasks`, `emailWeeklyReview`, `emailSessionReminders`, ' +
      '`emailAnnouncements`, `inAppEnabled` FROM `NotificationPreferences` WHERE `userId` = :userId LIMIT 1',
    { userId },
  );
  return rows[0] ?? null;
}

export async function createPrefs(userId: string): Promise<PrefsRow> {
  await db.execute<ResultSetHeader>(
    'INSERT INTO `NotificationPreferences` (`id`, `userId`) VALUES (:id, :userId)',
    { id: createId(), userId },
  );
  const prefs = await findPrefsByUserId(userId);
  if (!prefs) throw new Error('prefs insert did not persist');
  return prefs;
}

const PREF_COLUMNS = new Set([
  'emailDailyTasks',
  'emailWeeklyReview',
  'emailSessionReminders',
  'emailAnnouncements',
  'inAppEnabled',
]);

export async function updatePrefsFields(
  userId: string,
  fields: Record<string, unknown>,
): Promise<PrefsRow> {
  const entries = Object.entries(fields).filter(([col]) => PREF_COLUMNS.has(col));
  if (entries.length > 0) {
    const params: Record<string, string | number | boolean | null> = { userId };
    const setClauses = entries.map(([col, value]) => {
      params[col] = value as boolean;
      return `\`${col}\` = :${col}`;
    });
    await db.execute<ResultSetHeader>(
      `UPDATE \`NotificationPreferences\` SET ${setClauses.join(', ')} WHERE \`userId\` = :userId`,
      params,
    );
  }
  const prefs = await findPrefsByUserId(userId);
  if (!prefs) throw new Error('prefs not found after update');
  return prefs;
}
