import type {
  NotificationPreferencesView,
  ProfileMeView,
  StudentProfileView,
} from '@mentra/shared';
import type { NotificationPrefsPatchInput, ProfilePatchInput } from '@mentra/shared';
import { emit } from '../../core/events.js';
import { logger } from '../../logger.js';
import { unknownSkillIds } from './skills.service.js';
import {
  type PrefsRow,
  type ProfileRow,
  createPrefs,
  createProfile,
  findPrefsByUserId,
  findProfileByUserId,
  updatePrefsFields,
  updateProfileFields,
} from './user-profile.repository.js';

export class ProfileError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

const toBool = (v: 0 | 1 | boolean): boolean => v === true || v === 1;
const toArray = (v: string[] | null): string[] => v ?? [];
const toIso = (v: Date | null): string | null => (v ? new Date(v).toISOString() : null);

export function mapProfile(row: ProfileRow): StudentProfileView {
  return {
    id: row.id,
    userId: row.userId,
    avatarUrl: row.avatarUrl,
    bio: row.bio,
    country: row.country,
    city: row.city,
    timezone: row.timezone,
    educationLevel: row.educationLevel,
    collegeName: row.collegeName,
    graduationYear: row.graduationYear,
    experienceLevel: row.experienceLevel,
    currentRole: row.currentRole,
    currentCompany: row.currentCompany,
    goal: row.goal,
    preferredCompanyType: toArray(row.preferredCompanyType),
    targetRoles: toArray(row.targetRoles),
    studyHoursPerDay: row.studyHoursPerDay,
    techStack: toArray(row.techStack),
    githubUrl: row.githubUrl,
    linkedinUrl: row.linkedinUrl,
    portfolioUrl: row.portfolioUrl,
    twitterUrl: row.twitterUrl,
    resumeFileKey: row.resumeFileKey,
    resumeUploadedAt: toIso(row.resumeUploadedAt),
    onboardingStep: row.onboardingStep,
    onboardingComplete: toBool(row.onboardingComplete),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export function mapPrefs(row: PrefsRow): NotificationPreferencesView {
  return {
    emailDailyTasks: toBool(row.emailDailyTasks),
    emailWeeklyReview: toBool(row.emailWeeklyReview),
    emailSessionReminders: toBool(row.emailSessionReminders),
    emailAnnouncements: toBool(row.emailAnnouncements),
    inAppEnabled: toBool(row.inAppEnabled),
  };
}

/** Auto-create profile + prefs if missing. Idempotent; safe to call on every read. */
export async function ensureProfile(userId: string): Promise<ProfileRow> {
  const existing = await findProfileByUserId(userId);
  if (existing) return existing;
  const created = await createProfile(userId);
  logger.info({ userId }, 'profile.created');
  return created;
}

async function ensurePrefs(userId: string): Promise<PrefsRow> {
  const existing = await findPrefsByUserId(userId);
  if (existing) return existing;
  return createPrefs(userId);
}

export async function getProfileMe(userId: string): Promise<ProfileMeView> {
  const [profile, prefs] = await Promise.all([ensureProfile(userId), ensurePrefs(userId)]);
  return { profile: mapProfile(profile), notifications: mapPrefs(prefs) };
}

/** Cross-module export — used by dashboard, assessment, roadmap. */
export async function getProfile(userId: string): Promise<StudentProfileView> {
  const profile = await ensureProfile(userId);
  return mapProfile(profile);
}

function assertSkillsValid(techStack: string[] | undefined): void {
  if (!techStack) return;
  const unknown = unknownSkillIds(techStack);
  if (unknown.length > 0) {
    throw new ProfileError('UNKNOWN_SKILLS', `Unknown skill ids: ${unknown.join(', ')}`, 400);
  }
}

export async function patchProfile(
  userId: string,
  input: ProfilePatchInput,
): Promise<StudentProfileView> {
  await ensureProfile(userId);
  assertSkillsValid(input.techStack);

  const changedFields = Object.keys(input);
  const updated = await updateProfileFields(userId, input as Record<string, unknown>);

  logger.info({ userId, changedFields }, 'profile.updated');
  if (changedFields.length > 0) emit('student-profile.updated', { userId, changedFields });

  return mapProfile(updated);
}

export async function getNotificationPrefs(userId: string): Promise<NotificationPreferencesView> {
  const prefs = await ensurePrefs(userId);
  return mapPrefs(prefs);
}

export async function patchNotificationPrefs(
  userId: string,
  input: NotificationPrefsPatchInput,
): Promise<NotificationPreferencesView> {
  await ensurePrefs(userId);
  const updated = await updatePrefsFields(userId, input as Record<string, unknown>);
  return mapPrefs(updated);
}
