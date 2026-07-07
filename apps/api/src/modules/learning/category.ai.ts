import {
  learningCategoriesGenSchema,
  type LearningCategoryGenItem,
} from '@mentra/shared';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { AiError, generateJson } from '../../core/ai.js';

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

const SYSTEM = `You are a curriculum designer building a "test series" catalogue for ONE student.
RULES:
- Respond with a SINGLE JSON object ONLY. No markdown, no prose, no code fences.
- The JSON MUST match this exact shape:
  {
    "categories": [
      {
        "slug": string,          // stable kebab-case id, e.g. "interview-prep"
        "title": string,         // 1-4 words, e.g. "Interview Prep", "OOP Concepts", "CI/CD"
        "description": string,   // one sentence on what this series covers
        "skillTags": string[]    // 2-5 short skill/topic tags
      }
    ]
  }
GUIDELINES:
- Produce 6-9 categories tailored to the student's goal, target roles, tech stack, and roadmap topics.
- Cover a spread: fundamentals (e.g. OOP, DSA), the student's stack, ops (DevOps, CI/CD), system design, and interview prep.
- Categories are self-contained test series — they do NOT depend on roadmap completion.
- Slugs must be unique, lowercase, hyphenated. Keep titles short and human.`;

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
    const out = await generateJson({
      system: SYSTEM,
      user: buildUserPrompt(input),
      schema: learningCategoriesGenSchema,
      temperature: 0.5,
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
