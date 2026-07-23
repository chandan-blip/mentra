import type { DashboardOverview, DashboardRecommendation } from '@mentra/shared';
import { env } from '../../env.js';
import { getMe } from '../auth/auth.service.js';
import { getProfile } from '../user-profile/index.js';
import { getRecommender, type RecommenderContext } from './recommendation/index.js';
import { buildWidgets } from './widgets.service.js';
import { logRecommendationAck } from './dashboard.repository.js';

type ProfileLike = { onboardingComplete: boolean; goal: string | null; targetRoles: string[] };

/**
 * Derive the recommender context from the already-loaded profile. "Complete" means the
 * profile-setup fields (now edited under Settings) are filled enough to personalize.
 */
function toContext(profile: ProfileLike): RecommenderContext {
  return { profileComplete: Boolean(profile.goal && profile.targetRoles.length > 0) };
}

export async function getOverview(userId: string): Promise<DashboardOverview> {
  const [user, profile, widgets] = await Promise.all([getMe(userId), getProfile(userId), buildWidgets()]);

  const nextSteps = getRecommender()
    .generate(toContext(profile))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, env.DASHBOARD_NEXT_STEPS_LIMIT);

  return {
    profile: {
      name: user.name,
      avatarUrl: profile.avatarUrl,
      onboardingComplete: profile.onboardingComplete,
      memberSince: user.createdAt,
    },
    nextSteps,
    stats: { joinedAt: user.createdAt },
    widgets,
  };
}

export async function getNextSteps(userId: string, limit: number): Promise<DashboardRecommendation[]> {
  const profile = await getProfile(userId);
  return getRecommender()
    .generate(toContext(profile))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, limit);
}

export async function acknowledgeRecommendation(
  userId: string,
  recId: string,
  action: 'clicked' | 'dismissed',
): Promise<void> {
  await logRecommendationAck({ userId, recId, action });
}

export async function getStats(userId: string) {
  const user = await getMe(userId);
  return { joinedAt: user.createdAt };
}
