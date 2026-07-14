import {
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
