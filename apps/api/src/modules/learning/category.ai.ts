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
    'For each category also include a "benefit" (one line on what mastering it helps the student do) ' +
      'and "projects" (2–3 short example projects where the topic applies, e.g. "REST API backend").',
    'Return ONLY the JSON object of test-series categories.',
  ].join('\n\n');
}

/** Curated default catalogue used when the model is unavailable. */
function fallbackCategories(input: CategoryGenInput): LearningCategoryGenItem[] {
  const base: LearningCategoryGenItem[] = [
    { slug: 'interview-prep', title: 'Interview Prep', description: 'Common technical interview questions across topics.', skillTags: ['interview', 'problem-solving'], benefit: 'Walk into technical interviews confident on the questions that come up most.', projects: ['Coding interview prep', 'Take-home assignments'] },
    { slug: 'oop-concepts', title: 'OOP Concepts', description: 'Object-oriented programming principles and patterns.', skillTags: ['oop', 'design-patterns'], benefit: 'Model real domains with clean, maintainable class designs.', projects: ['E-commerce domain model', 'Game engine', 'Library management app'] },
    { slug: 'data-structures', title: 'Data Structures & Algorithms', description: 'Core DSA fundamentals and complexity.', skillTags: ['dsa', 'algorithms'], benefit: 'Write efficient code and reason about time/space trade-offs.', projects: ['Search/autocomplete', 'Route finder', 'Rate limiter'] },
    { slug: 'system-design', title: 'System Design', description: 'Designing scalable systems and trade-offs.', skillTags: ['architecture', 'scalability'], benefit: 'Design systems that scale and defend the trade-offs.', projects: ['URL shortener', 'Chat backend', 'News feed'] },
    { slug: 'databases', title: 'Databases', description: 'SQL, indexing, transactions, and modeling.', skillTags: ['sql', 'databases'], benefit: 'Model data and write fast, correct queries.', projects: ['Analytics dashboard', 'Booking system', 'Inventory tracker'] },
    { slug: 'devops', title: 'DevOps', description: 'Containers, deployment, and infrastructure basics.', skillTags: ['docker', 'infra'], benefit: 'Ship and run your apps reliably in production.', projects: ['Containerized app', 'Zero-downtime deploy'] },
    { slug: 'ci-cd', title: 'CI/CD', description: 'Continuous integration and delivery pipelines.', skillTags: ['ci', 'automation'], benefit: 'Automate testing and releases so shipping is boring.', projects: ['GitHub Actions pipeline', 'Automated release flow'] },
  ];
  // Fold in the student's tech stack as extra tagged categories where sensible.
  const extra = input.techStack.slice(0, 2).map((tech) => ({
    slug: tech.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'stack',
    title: tech,
    description: `Test your knowledge of ${tech}.`,
    skillTags: [tech.toLowerCase()],
    benefit: `Apply ${tech} confidently in real projects.`,
    projects: [`${tech} project`],
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
