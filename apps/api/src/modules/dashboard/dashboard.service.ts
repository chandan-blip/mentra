import type { DashboardOverview, DashboardRecommendation } from '@mentra/shared';
import { env } from '../../env.js';
import { getMe } from '../auth/auth.service.js';
import { getProfile } from '../user-profile/index.js';
import { getAssignmentStatus } from '../assignment/index.js';
import { getRecommender, type RecommenderContext } from './recommendation/index.js';
import { buildWidgets } from './widgets.service.js';
import { logRecommendationAck } from './dashboard.repository.js';

async function buildContext(userId: string): Promise<RecommenderContext> {
  const [profile, assignment] = await Promise.all([getProfile(userId), getAssignmentStatus(userId)]);
  const status: RecommenderContext['assignmentStatus'] =
    assignment.status === 'completed' ? 'completed' : assignment.status === 'ready' ? 'ready' : 'not_started';
  return {
    onboardingComplete: profile.onboardingComplete,
    assignmentStatus: status,
    assignmentScore: assignment.score,
  };
}

export async function getOverview(userId: string): Promise<DashboardOverview> {
  const [user, profile, assignment, ctx, widgets] = await Promise.all([
    getMe(userId),
    getProfile(userId),
    getAssignmentStatus(userId),
    buildContext(userId),
    buildWidgets(),
  ]);

  const nextSteps = getRecommender()
    .generate(ctx)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, env.DASHBOARD_NEXT_STEPS_LIMIT);

  return {
    profile: {
      name: user.name,
      avatarUrl: profile.avatarUrl,
      onboardingComplete: profile.onboardingComplete,
      memberSince: user.createdAt,
    },
    assignment: {
      exists: assignment.exists,
      status: assignment.status,
      score: assignment.score,
    },
    nextSteps,
    stats: { joinedAt: user.createdAt },
    widgets,
  };
}

export async function getNextSteps(userId: string, limit: number): Promise<DashboardRecommendation[]> {
  const ctx = await buildContext(userId);
  return getRecommender()
    .generate(ctx)
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
