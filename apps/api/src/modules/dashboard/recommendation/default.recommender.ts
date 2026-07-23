import type { DashboardRecommendation } from '@mentra/shared';
import type { Recommender, RecommenderContext } from './recommender.interface.js';

/**
 * MVP rule-based recommender: nudge the student to complete their profile-setup fields
 * (now under Settings) so the rest of the app can personalize. Nothing to show once done.
 */
export const defaultRecommender: Recommender = {
  name: 'default',
  generate(ctx: RecommenderContext): DashboardRecommendation[] {
    const recs: DashboardRecommendation[] = [];

    if (!ctx.profileComplete) {
      recs.push({
        recId: 'finish-profile',
        title: 'Finish setting up your profile',
        body: 'Add your goals, target roles, and tech stack so we can tailor your learning.',
        cta: { label: 'Open settings', href: '/settings?tab=settings' },
        priority: 0,
      });
    }

    return recs;
  },
};
