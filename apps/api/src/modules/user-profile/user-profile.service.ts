import type {
  FollowResultView,
  NotificationPreferencesView,
  ProfileMeView,
  PublicProfileCardView,
  PublicProfileView,
  StudentProfileView,
} from '@mentra/shared';
import type { NotificationPrefsPatchInput, ProfilePatchInput } from '@mentra/shared';
import { emit } from '../../core/events.js';
import { logger } from '../../logger.js';
import { unknownSkillIds } from './skills.service.js';
import {
  type DirectoryRow,
  type PrefsRow,
  type ProfileRow,
  activeRoadmapProgress,
  countFollowers,
  countFollowing,
  countPostsByAuthor,
  createPrefs,
  createProfile,
  deleteFollow,
  findPrefsByUserId,
  findProfileByUserId,
  insertFollow,
  isFollowing,
  listDirectory,
  updatePrefsFields,
  updateProfileFields,
  updateUserName,
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
    name: row.name,
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

/** "Role · Company" (or just the role / goal) — the one-line headline for cards + hero. */
function buildHeadline(row: {
  currentRole: string | null;
  currentCompany: string | null;
  goal: string | null;
}): string | null {
  if (row.currentRole && row.currentCompany) return `${row.currentRole} · ${row.currentCompany}`;
  if (row.currentRole) return row.currentRole;
  return row.goal ?? null;
}

const joinLocation = (city: string | null, country: string | null): string | null =>
  [city, country].filter(Boolean).join(', ') || null;

/**
 * Public profile shown to OTHER students: identity subset + computed achievement
 * stats + social-graph counts. Never exposes resume, notification prefs, or
 * onboarding internals. `viewerId` is the requesting user (for isSelf/isFollowed).
 */
export async function getPublicProfile(userId: string, viewerId: string): Promise<PublicProfileView> {
  const profile = await findProfileByUserId(userId);
  if (!profile) throw new ProfileError('NOT_FOUND', 'Profile not found', 404);

  const isSelf = viewerId === userId;
  const [communityPosts, roadmapCompletion, followers, following, followedByViewer] = await Promise.all([
    countPostsByAuthor(userId),
    activeRoadmapProgress(userId),
    countFollowers(userId),
    countFollowing(userId),
    isSelf ? Promise.resolve(false) : isFollowing(viewerId, userId),
  ]);

  const techStack = toArray(profile.techStack);
  return {
    userId: profile.userId,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    city: profile.city,
    country: profile.country,
    currentRole: profile.currentRole,
    currentCompany: profile.currentCompany,
    experienceLevel: profile.experienceLevel,
    goal: profile.goal,
    targetRoles: toArray(profile.targetRoles),
    techStack,
    githubUrl: profile.githubUrl,
    linkedinUrl: profile.linkedinUrl,
    portfolioUrl: profile.portfolioUrl,
    twitterUrl: profile.twitterUrl,
    stats: {
      memberSince: new Date(profile.createdAt).toISOString(),
      skillCount: techStack.length,
      roadmapCompletion,
      communityPosts,
    },
    followers,
    following,
    isFollowedByViewer: followedByViewer,
    isSelf,
  };
}

function mapDirectoryRow(row: DirectoryRow): PublicProfileCardView {
  return {
    userId: row.userId,
    name: row.name,
    avatarUrl: row.avatarUrl,
    headline: buildHeadline(row),
    location: joinLocation(row.city, row.country),
    techStack: toArray(row.techStack).slice(0, 5),
    followers: Number(row.followers ?? 0),
    isFollowedByViewer: row.isFollowedByViewer === 1,
  };
}

/** Browsable student directory (onboarded profiles, excluding the viewer). */
export async function getDirectory(
  viewerId: string,
  q?: string,
  limit = 60,
): Promise<PublicProfileCardView[]> {
  const rows = await listDirectory({ viewerId, q, limit: Math.min(Math.max(limit, 1), 100) });
  return rows.map(mapDirectoryRow);
}

/** Follow another student. Idempotent; no-op if self. Returns the fresh count + state. */
export async function followUser(followerId: string, followeeId: string): Promise<FollowResultView> {
  if (followerId === followeeId) throw new ProfileError('CANNOT_FOLLOW_SELF', 'You cannot follow yourself', 400);
  const target = await findProfileByUserId(followeeId);
  if (!target) throw new ProfileError('NOT_FOUND', 'Profile not found', 404);
  await insertFollow(followerId, followeeId);
  return { following: true, followers: await countFollowers(followeeId) };
}

export async function unfollowUser(followerId: string, followeeId: string): Promise<FollowResultView> {
  await deleteFollow(followerId, followeeId);
  return { following: false, followers: await countFollowers(followeeId) };
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

  // `name` targets the User record, not StudentProfile; the rest are profile columns.
  const { name, ...profileFields } = input;
  if (name !== undefined) await updateUserName(userId, name);

  const changedFields = Object.keys(input);
  const updated = await updateProfileFields(userId, profileFields as Record<string, unknown>);

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
