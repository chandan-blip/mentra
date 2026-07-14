import { roadmapTestGenSchema, type RoadmapTestQuestionGen } from '@mentra/shared';
import { env } from '../../../env.js';
import { logger } from '../../../logger.js';
import { AiError, generateJson } from '../../../core/ai.js';
import { getPromptConfig } from '../../ai-prompt/ai-prompt.service.js';
import { PROMPT_KEYS } from '../../ai-prompt/ai-prompt.registry.js';

/**
 * Generate the completion test for a topic. The test MUST cover every subtopic, so
 * the marks reflect what the student actually learned across the whole topic. One
 * AI call, generated on demand when the student starts the test; the caller caches
 * the questions in the DB. Falls back to a deterministic stub if the model is down.
 */

export type TestSubtopic = { title: string; description: string | null };

function buildUserPrompt(topicTitle: string, subtopics: TestSubtopic[]): string {
  const list = subtopics
    .map((s, i) => `${i + 1}. ${s.title}${s.description ? ` — ${s.description}` : ''}`)
    .join('\n');
  return [
    `Write the mastery test for the topic "${topicTitle}".`,
    `It must cover all ${subtopics.length} subtopics below:`,
    list,
    'Return ONLY the JSON object.',
  ].join('\n\n');
}

/** Deterministic fallback: one trivial question per subtopic so a test always exists. */
function fallbackQuestions(subtopics: TestSubtopic[]): RoadmapTestQuestionGen[] {
  return subtopics.map((s) => ({
    subtopicTitle: s.title,
    type: 'single_choice' as const,
    body: `Which statement best describes "${s.title}"?`,
    options: [
      s.description ?? `A correct description of ${s.title}.`,
      'An unrelated concept.',
      'A deprecated practice with no modern use.',
      'None of the above.',
    ],
    correct: [0],
    explanation: `The first option matches what "${s.title}" covers.`,
    points: 1,
  }));
}

export async function generateTestQuestions(input: {
  topicTitle: string;
  subtopics: TestSubtopic[];
}): Promise<{ model: string; questions: RoadmapTestQuestionGen[] }> {
  const cfg = await getPromptConfig(PROMPT_KEYS.roadmapTopicTest);
  const system = cfg.system.replaceAll('{PER}', String(env.ROADMAP_TEST_QUESTIONS_PER_SUBTOPIC));
  try {
    const out = await generateJson({
      system,
      user: buildUserPrompt(input.topicTitle, input.subtopics),
      schema: roadmapTestGenSchema,
      temperature: cfg.temperature,
    });
    const questions = out.questions.slice(0, env.ROADMAP_TEST_MAX_QUESTIONS);
    return { model: env.AI_MODEL, questions };
  } catch (err) {
    if (err instanceof AiError) {
      logger.warn({ topic: input.topicTitle, code: err.code }, 'roadmap.test.fallback_to_default');
      return {
        model: 'default-v1',
        questions: fallbackQuestions(input.subtopics).slice(0, env.ROADMAP_TEST_MAX_QUESTIONS),
      };
    }
    throw err;
  }
}
