import type { DashboardRecommendation } from '@mentra/shared';

export type RecommenderContext = {
  onboardingComplete: boolean;
  assignmentStatus: 'ready' | 'completed' | 'not_started';
  assignmentScore: number | null;
};

/** Pluggable recommendation engine — the seam for the user's custom algorithm. */
export interface Recommender {
  readonly name: string;
  generate(ctx: RecommenderContext): DashboardRecommendation[];
}
