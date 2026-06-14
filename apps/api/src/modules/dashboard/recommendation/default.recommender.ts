import type { DashboardRecommendation } from '@mentra/shared';
import type { Recommender, RecommenderContext } from './recommender.interface.js';

/**
 * MVP rule-based recommender:
 *  - profile incomplete → finish profile
 *  - assignment not done → take/finish it (top priority)
 *  - else → open the personalized roadmap
 */
export const defaultRecommender: Recommender = {
  name: 'default',
  generate(ctx: RecommenderContext): DashboardRecommendation[] {
    const recs: DashboardRecommendation[] = [];

    if (!ctx.onboardingComplete) {
      recs.push({
        recId: 'finish-profile',
        title: 'Finish your profile',
        body: 'Add your background, goals, and tech stack so we can tailor your assignment.',
        cta: { label: 'Open settings', href: '/settings' },
        priority: 0,
      });
    }

    if (ctx.assignmentStatus !== 'completed') {
      const resuming = ctx.assignmentStatus === 'ready';
      recs.push({
        recId: 'take-assignment',
        title: resuming ? 'Finish your assignment' : 'Take your assignment',
        body: resuming
          ? 'You have an assignment ready — complete it to generate your roadmap.'
          : 'A short, personalized assignment that calibrates your level and builds your roadmap.',
        cta: { label: resuming ? 'Continue' : 'Start assignment', href: '/assignment' },
        priority: 1,
      });
      return recs;
    }

    // Completed → point them at the roadmap their assignment generated.
    recs.push({
      recId: 'open-roadmap',
      title: 'Follow your roadmap',
      body:
        ctx.assignmentScore !== null
          ? `You scored ${ctx.assignmentScore}% — your personalized weekly plan is ready.`
          : 'Your personalized weekly plan is ready.',
      cta: { label: 'Open roadmap', href: '/roadmap' },
      priority: 1,
    });

    return recs;
  },
};
