import { roadmapSubtopicsGenSchema, type RoadmapSubtopicGenItem } from '@mentra/shared';
import { env } from '../../../env.js';
import { logger } from '../../../logger.js';
import { AiError, generateJson } from '../../../core/ai.js';

/**
 * Break a single roadmap topic into the COMPLETE set of subtopics a student must
 * learn — so they never have to decide the scope themselves. Generated on demand
 * the first time a topic is opened; the caller caches the rows in the DB, so this
 * never runs twice for the same topic. Falls back to a deterministic stub if the
 * model is unavailable, so a topic always ends up with subtopics.
 */

export type SubtopicContext = {
  title: string;
  description: string | null;
  skillIds: string[];
};

const SYSTEM = `You are a senior software-engineering mentor breaking ONE study topic into its complete set of subtopics.
RULES:
- Respond with a SINGLE JSON object ONLY. No markdown, no prose, no code fences.
- The JSON MUST match this exact shape:
  {
    "subtopics": [
      {
        "title": string,            // short, specific subtopic name
        "description": string,      // 1-2 sentences on exactly what to learn and why it matters
        "estimatedMin": number      // realistic minutes to learn this subtopic
      }
    ]
  }
GUIDELINES:
- Be EXHAUSTIVE for this topic: include every subtopic a student needs so they never have to wonder what else to study. Order them from foundational to advanced.
- Produce between {MIN} and {MAX} subtopics. Merge trivia; split anything that is really two ideas.
- Keep titles concrete and descriptions actionable. No filler, no duplicates.`;

function buildUserPrompt(topic: SubtopicContext): string {
  const blocks = [
    `Topic: ${topic.title}`,
    topic.description ? `Topic description: ${topic.description}` : 'Topic description: (none)',
    `Related skills: ${topic.skillIds.length ? topic.skillIds.join(', ') : 'unspecified'}`,
  ];
  return `Break down this topic into its complete subtopic list:\n\n${blocks.join('\n')}\n\nReturn ONLY the JSON object.`;
}

/** Deterministic fallback: a minimal, generic breakdown so the topic is never empty. */
function fallbackSubtopics(topic: SubtopicContext): RoadmapSubtopicGenItem[] {
  return [
    { title: `${topic.title}: core concepts`, description: `The foundational ideas behind ${topic.title}.`, estimatedMin: 30 },
    { title: `${topic.title}: practical usage`, description: `How ${topic.title} is applied in real code.`, estimatedMin: 45 },
    { title: `${topic.title}: common pitfalls`, description: `Mistakes to avoid and edge cases for ${topic.title}.`, estimatedMin: 30 },
    { title: `${topic.title}: practice & review`, description: `Exercises to consolidate ${topic.title}.`, estimatedMin: 45 },
  ];
}

export async function generateSubtopics(topic: SubtopicContext): Promise<{
  model: string;
  subtopics: RoadmapSubtopicGenItem[];
}> {
  const system = SYSTEM.replaceAll('{MIN}', String(env.ROADMAP_SUBTOPICS_MIN)).replaceAll(
    '{MAX}',
    String(env.ROADMAP_SUBTOPICS_MAX),
  );
  try {
    const out = await generateJson({
      system,
      user: buildUserPrompt(topic),
      schema: roadmapSubtopicsGenSchema,
      temperature: 0.3,
    });
    const subtopics = out.subtopics.slice(0, env.ROADMAP_SUBTOPICS_MAX);
    return { model: env.AI_MODEL, subtopics };
  } catch (err) {
    if (err instanceof AiError) {
      logger.warn({ topic: topic.title, code: err.code }, 'roadmap.subtopics.fallback_to_default');
      return { model: 'default-v1', subtopics: fallbackSubtopics(topic) };
    }
    throw err;
  }
}
