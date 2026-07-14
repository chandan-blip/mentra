import {
  learningCategoriesGenSchema,
  type LearningCategoryGenItem,
} from '@mentra/shared';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { AiError, generateJson } from '../../core/ai.js';
import { getPromptConfig } from '../ai-prompt/ai-prompt.service.js';
import { PROMPT_KEYS } from '../ai-prompt/ai-prompt.registry.js';

/**
 * Generate a student's test-series categories from their roadmap topics + profile.
 * One AI call on first visit to the Learning module; the caller caches the result in
 * the DB (never regenerated speculatively). Falls back to a curated default set so the
 * module always has content even if the model is down.
 */

export type CategoryGenInput = {
  goal: string | null;
  targetRoles: string[];
  techStack: string[];
  topicTitles: string[];
};

function buildUserPrompt(input: CategoryGenInput): string {
  const roles = input.targetRoles.length ? input.targetRoles.join(', ') : 'software engineering';
  const stack = input.techStack.length ? input.techStack.join(', ') : 'general';
  const topics = input.topicTitles.length
    ? input.topicTitles.slice(0, 40).map((t, i) => `${i + 1}. ${t}`).join('\n')
    : '(no roadmap topics yet)';
  return [
    `Goal: ${input.goal ?? 'become job-ready'}`,
    `Target roles: ${roles}`,
    `Tech stack: ${stack}`,
    `Roadmap topics:\n${topics}`,
    'Return ONLY the JSON object of test-series categories.',
  ].join('\n\n');
}

/** Curated default catalogue used when the model is unavailable. */
function fallbackCategories(input: CategoryGenInput): LearningCategoryGenItem[] {
  const base: LearningCategoryGenItem[] = [
    { slug: 'interview-prep', title: 'Interview Prep', description: 'Common technical interview questions across topics.', skillTags: ['interview', 'problem-solving'] },
    { slug: 'oop-concepts', title: 'OOP Concepts', description: 'Object-oriented programming principles and patterns.', skillTags: ['oop', 'design-patterns'] },
    { slug: 'data-structures', title: 'Data Structures & Algorithms', description: 'Core DSA fundamentals and complexity.', skillTags: ['dsa', 'algorithms'] },
    { slug: 'system-design', title: 'System Design', description: 'Designing scalable systems and trade-offs.', skillTags: ['architecture', 'scalability'] },
    { slug: 'databases', title: 'Databases', description: 'SQL, indexing, transactions, and modeling.', skillTags: ['sql', 'databases'] },
    { slug: 'devops', title: 'DevOps', description: 'Containers, deployment, and infrastructure basics.', skillTags: ['docker', 'infra'] },
    { slug: 'ci-cd', title: 'CI/CD', description: 'Continuous integration and delivery pipelines.', skillTags: ['ci', 'automation'] },
  ];
  // Fold in the student's tech stack as extra tagged categories where sensible.
  const extra = input.techStack.slice(0, 2).map((tech) => ({
    slug: tech.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'stack',
    title: tech,
    description: `Test your knowledge of ${tech}.`,
    skillTags: [tech.toLowerCase()],
  }));
  const seen = new Set<string>();
  return [...base, ...extra].filter((c) => (seen.has(c.slug) ? false : (seen.add(c.slug), true)));
}

export async function generateCategories(
  input: CategoryGenInput,
): Promise<{ model: string; categories: LearningCategoryGenItem[] }> {
  try {
    const cfg = await getPromptConfig(PROMPT_KEYS.learningCategories);
    const out = await generateJson({
      system: cfg.system,
      user: buildUserPrompt(input),
      schema: learningCategoriesGenSchema,
      temperature: cfg.temperature,
    });
    return { model: env.AI_MODEL, categories: out.categories };
  } catch (err) {
    if (err instanceof AiError) {
      logger.warn({ code: err.code }, 'learning.categories.fallback_to_default');
      return { model: 'default-v1', categories: fallbackCategories(input) };
    }
    throw err;
  }
}
