import type { DashboardRecommendation } from '@mentra/shared';

export type RecommenderContext = {
  profileComplete: boolean;
};

/** Pluggable recommendation engine — the seam for the user's custom algorithm. */
export interface Recommender {
  readonly name: string;
  generate(ctx: RecommenderContext): DashboardRecommendation[];
}
