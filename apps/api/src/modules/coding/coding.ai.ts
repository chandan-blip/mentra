import { codingReviewSchema, type CodingLanguage } from '@mentra/shared';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { AiError, generateJson } from '../../core/ai.js';
import { getPromptConfig } from '../ai-prompt/ai-prompt.service.js';
import { PROMPT_KEYS } from '../ai-prompt/ai-prompt.registry.js';

/**
 * Short mentor-style AI review of a graded submission. The pass/fail verdict comes from the
 * sandbox (see coding.exec) — this only adds a human-feeling comment + quality score, which
 * we persist alongside the submission. Non-fatal: any AI failure returns a null review so a
 * submission is never blocked by the model being down.
 */

type ReviewInput = {
  title: string;
  description: string;
  language: CodingLanguage;
  code: string;
  passedCount: number;
  totalCount: number;
};

export type CodingReviewResult = { feedback: string; quality: number; model: string } | null;

function buildUserPrompt(input: ReviewInput): string {
  return [
    `Task: ${input.title}`,
    `Problem statement:\n${input.description}`,
    `Language: ${input.language}`,
    `Auto-grade: ${input.passedCount}/${input.totalCount} test cases passed.`,
    'Student submission:',
    '```',
    input.code.slice(0, 12_000),
    '```',
  ].join('\n');
}

export async function reviewSubmission(input: ReviewInput): Promise<CodingReviewResult> {
  try {
    const cfg = await getPromptConfig(PROMPT_KEYS.codingReview);
    const out = await generateJson({
      system: cfg.system,
      user: buildUserPrompt(input),
      schema: codingReviewSchema,
      temperature: cfg.temperature,
    });
    const suffix = out.suggestions.length
      ? `\n\nSuggestions:\n${out.suggestions.map((s) => `• ${s}`).join('\n')}`
      : '';
    return { feedback: `${out.feedback}${suffix}`.trim(), quality: out.quality, model: env.AI_MODEL };
  } catch (err) {
    if (err instanceof AiError) {
      logger.warn({ code: err.code }, 'coding.review.skipped');
      return null;
    }
    throw err;
  }
}
