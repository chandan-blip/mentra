import { env } from '../../../env.js';
import type { Recommender } from './recommender.interface.js';
import { defaultRecommender } from './default.recommender.js';

const registry: Record<string, Recommender> = {
  default: defaultRecommender,
};

export function getRecommender(): Recommender {
  return registry[env.DASHBOARD_RECOMMENDER_STRATEGY] ?? defaultRecommender;
}

export type { Recommender, RecommenderContext } from './recommender.interface.js';
