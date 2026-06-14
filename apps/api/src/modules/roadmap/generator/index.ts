import { env } from '../../../env.js';
import type { RoadmapGenerator } from './generator.interface.js';
import { defaultGenerator } from './default.generator.js';
import { aiGenerator } from './ai.generator.js';

const registry: Record<string, RoadmapGenerator> = {
  default: defaultGenerator,
  ai: aiGenerator,
};

export function getGenerator(): RoadmapGenerator {
  return registry[env.ROADMAP_GENERATOR_STRATEGY] ?? defaultGenerator;
}

export type { RoadmapGenerator } from './generator.interface.js';
export type { GeneratorInput, RoadmapPlan } from './types.js';
