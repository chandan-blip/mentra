import type { GeneratorInput, RoadmapPlan } from './types.js';

/** Pluggable roadmap generator — the seam for the user's custom algorithm. */
export interface RoadmapGenerator {
  readonly id: string;
  generate(input: GeneratorInput): Promise<RoadmapPlan>;
}
