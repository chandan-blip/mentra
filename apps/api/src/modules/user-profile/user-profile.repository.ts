import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../../db.js';
import { env } from '../../env.js';
import { createId } from '../../core/id.js';

export type ProfileRow = {
  id: string;
  userId: string;
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

const PROFILE_COLUMNS =
  '`id`, `userId`, `avatarUrl`, `bio`, `country`, `city`, `timezone`, `educationLevel`, ' +
  '`collegeName`, `graduationYear`, `experienceLevel`, `currentRole`, `currentCompany`, `goal`, ' +
  '`preferredCompanyType`, `targetRoles`, `studyHoursPerDay`, `techStack`, `githubUrl`, ' +
  '`linkedinUrl`, `portfolioUrl`, `twitterUrl`, `resumeFileKey`, `resumeUploadedAt`, ' +
  '`avatarFileKey`, `onboardingStep`, `onboardingComplete`, `createdAt`, `updatedAt`';

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
    `SELECT ${PROFILE_COLUMNS} FROM \`StudentProfile\` WHERE \`userId\` = :userId LIMIT 1`,
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
