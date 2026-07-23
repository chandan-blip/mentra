import {
  customLearningTestGenSchema,
  learningTestGenSchema,
  type LearningDifficulty,
  type LearningTestQuestionGen,
} from '@mentra/shared';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { AiError, generateJson } from '../../core/ai.js';
import { getPromptConfig } from '../ai-prompt/ai-prompt.service.js';
import { PROMPT_KEYS } from '../ai-prompt/ai-prompt.registry.js';

/**
 * Generate the MCQ set for one test in a category's difficulty ladder. One AI call on
 * first start; the caller caches the questions in the DB. Falls back to a deterministic
 * stub so a test always exists.
 */

export type TestGenInput = {
  categoryTitle: string;
  categoryDescription: string;
  skillTags: string[];
  difficulty: LearningDifficulty;
  count: number;
};

const DIFFICULTY_HINT: Record<LearningDifficulty, string> = {
  beginner: 'foundational recall and definitions; keep it approachable',
  intermediate: 'applied understanding, comparisons, and common gotchas',
  advanced: 'deep trade-offs, edge cases, and scenario-based reasoning',
};

function buildUserPrompt(input: TestGenInput): string {
  const tags = input.skillTags.length ? input.skillTags.join(', ') : input.categoryTitle;
  return [
    `Write a ${input.difficulty} test of exactly ${input.count} questions for the category "${input.categoryTitle}".`,
    `Category focus: ${input.categoryDescription}`,
    `Relevant skills/tags: ${tags}`,
    `Difficulty target: ${DIFFICULTY_HINT[input.difficulty]}.`,
    'Return ONLY the JSON object.',
  ].join('\n\n');
}

/** Deterministic fallback: trivial questions so a test always exists. */
function fallbackQuestions(input: TestGenInput): LearningTestQuestionGen[] {
  return Array.from({ length: Math.min(input.count, 5) }, (_, i) => ({
    type: 'single_choice' as const,
    body: `(${input.difficulty}) Sample question ${i + 1} about ${input.categoryTitle}. Which statement is correct?`,
    options: [
      `A correct fact about ${input.categoryTitle}.`,
      'An unrelated concept.',
      'A deprecated practice with no modern use.',
      'None of the above.',
    ],
    correct: [0],
    explanation: `The first option matches ${input.categoryTitle}.`,
    points: 1,
  }));
}

export async function generateTestQuestions(
  input: TestGenInput,
): Promise<{ model: string; questions: LearningTestQuestionGen[] }> {
  try {
    const cfg = await getPromptConfig(PROMPT_KEYS.learningTest);
    const out = await generateJson({
      system: cfg.system,
      user: buildUserPrompt(input),
      schema: learningTestGenSchema,
      temperature: cfg.temperature,
    });
    return { model: env.AI_MODEL, questions: out.questions.slice(0, input.count) };
  } catch (err) {
    if (err instanceof AiError) {
      logger.warn(
        { category: input.categoryTitle, difficulty: input.difficulty, code: err.code },
        'learning.test.fallback_to_default',
      );
      return { model: 'default-v1', questions: fallbackQuestions(input) };
    }
    throw err;
  }
}

// --- Custom quizzes (student "build your own") ---

export type CustomQuizGenInput = {
  topic: string;
  experienceLevel: number; // 0–10
  languages: string[];
  difficulty: LearningDifficulty; // bucketed from experienceLevel
  count: number; // 10–100
};

function buildCustomPrompt(input: CustomQuizGenInput): string {
  const tech = input.languages.length ? input.languages.join(', ') : 'any relevant tools';
  return [
    `Write a quiz of exactly ${input.count} multiple-choice questions on the topic "${input.topic}".`,
    `The learner rates their experience at ${input.experienceLevel} out of 10 — pitch difficulty accordingly (${DIFFICULTY_HINT[input.difficulty]}).`,
    `Bias questions toward these languages/tech where natural: ${tech}.`,
    'Cover the topic broadly: definitions, practical application, common mistakes, and trade-offs. Avoid duplicate questions.',
    'Also include a "benefit" (one line on what mastering this topic helps the learner do) and ' +
      '"projects" (2–3 short example projects where this topic applies, e.g. "REST API backend").',
    'Return ONLY the JSON object.',
  ].join('\n\n');
}

/** Deterministic fallback so a custom quiz always has content even if the model is down. */
function customFallback(input: CustomQuizGenInput): LearningTestQuestionGen[] {
  return Array.from({ length: Math.min(input.count, 5) }, (_, i) => ({
    type: 'single_choice' as const,
    body: `(${input.difficulty}) Sample question ${i + 1} about ${input.topic}. Which statement is correct?`,
    options: [
      `A correct fact about ${input.topic}.`,
      'An unrelated concept.',
      'A deprecated practice with no modern use.',
      'None of the above.',
    ],
    correct: [0],
    explanation: `The first option matches ${input.topic}.`,
    points: 1,
  }));
}

/**
 * Generate the MCQ set for a student-requested custom topic. One AI call; the caller caches
 * the questions as a shared quiz so future students with the same topic + level are served
 * from the DB with no further AI cost.
 */
export async function generateCustomQuizQuestions(
  input: CustomQuizGenInput,
): Promise<{ model: string; benefit: string; projects: string[]; questions: LearningTestQuestionGen[] }> {
  try {
    const cfg = await getPromptConfig(PROMPT_KEYS.learningTest);
    const out = await generateJson({
      system: cfg.system,
      user: buildCustomPrompt(input),
      schema: customLearningTestGenSchema,
      temperature: cfg.temperature,
    });
    return {
      model: env.AI_MODEL,
      benefit: out.benefit,
      projects: out.projects,
      questions: out.questions.slice(0, input.count),
    };
  } catch (err) {
    if (err instanceof AiError) {
      logger.warn({ topic: input.topic, difficulty: input.difficulty, code: err.code }, 'learning.custom.fallback_to_default');
      return {
        model: 'default-v1',
        benefit: `Get hands-on, testable knowledge of ${input.topic}.`,
        projects: [],
        questions: customFallback(input),
      };
    }
    throw err;
  }
}
