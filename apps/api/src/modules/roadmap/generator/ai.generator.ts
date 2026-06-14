import { roadmapPlanSchema } from '@mentra/shared';
import { env } from '../../../env.js';
import { logger } from '../../../logger.js';
import { AiError, generateJson } from '../../../core/ai.js';
import type { RoadmapGenerator } from './generator.interface.js';
import { defaultGenerator } from './default.generator.js';
import type { GeneratorAssignment, GeneratorInput, GeneratorSkill, RoadmapPlan } from './types.js';

/**
 * AI roadmap generator. Turns the student's profile + skill matrix + completed
 * assignment into a personalized, week-by-week plan. One AI call per generation;
 * the result is persisted by the service, so we never re-call for the same plan.
 * Falls back to the deterministic generator if the model is unavailable, so a
 * student always ends up with a roadmap.
 */

const SYSTEM = `You are a senior software-engineering mentor building a personalized study roadmap for ONE student.
RULES:
- Respond with a SINGLE JSON object ONLY. No markdown, no prose, no code fences.
- The JSON MUST match this exact shape:
  {
    "totalWeeks": number,                    // matches weeks.length
    "weeks": [
      {
        "weekNumber": number,                // 1-based, sequential
        "title": string,
        "theme": string,                     // e.g. "Foundations", "Core skills", "Projects & review"
        "items": [
          {
            "key": string,                   // unique slug across the whole plan, e.g. "w1-arrays"
            "type": "topic" | "project" | "assessment" | "session" | "reading" | "practice",
            "title": string,
            "description": string,
            "skillIds": string[],            // lowercase skill slugs, e.g. ["dsa","javascript"]
            "estimatedMin": number,
            "dependsOn": string[]            // keys of earlier items that must finish first
          }
        ]
      }
    ],
    "notes": string                          // 1-2 sentences on how this plan was tailored
  }
GUIDELINES:
- Prioritize the student's WEAKEST skills first; reinforce strengths later.
- Use the assignment results (which topics they got wrong, their self-reported constraints) to decide focus and pace.
- Pace items to the student's available study hours. Early weeks = foundations; later weeks add projects; end with a review/assessment.
- Each week MUST have between {MIN} and {MAX} items. Use {MAXWEEKS} weeks at most.
- Make titles and descriptions concrete and actionable. No filler.`;

function skillLine(s: GeneratorSkill): string {
  return `- ${s.label} (${s.skillId}): score ${s.score}/100, confidence ${Math.round(s.confidence * 100)}%`;
}

function assignmentBlock(a: GeneratorAssignment): string {
  const tasks = a.tasks
    .map((t) => {
      const mark = t.correct === null ? 'n/a' : t.correct ? 'correct' : 'WRONG';
      return `- [${t.type}] ${t.title} (${mark}) skills: ${t.skillIds.join(', ') || 'none'}`;
    })
    .join('\n');
  const closing = a.closingAnswers.map((c) => `- Q: ${c.prompt}\n  A: ${c.answer}`).join('\n');
  return [
    `Assignment summary: ${a.summary}`,
    `MCQ score: ${a.score === null ? 'n/a' : `${a.score}/100`}`,
    `Task results:\n${tasks || '(none)'}`,
    `Closing answers:\n${closing || '(none)'}`,
  ].join('\n');
}

function buildUserPrompt(input: GeneratorInput): string {
  const skills =
    input.skillMatrix.length > 0
      ? input.skillMatrix.map(skillLine).join('\n')
      : '(no assessment data; rely on tech stack + assignment)';
  const blocks = [
    `Career goal: ${input.goal ?? 'unspecified'}`,
    `Target roles: ${input.targetRoles.length ? input.targetRoles.join(', ') : 'unspecified'}`,
    `Tech stack: ${input.techStack.length ? input.techStack.join(', ') : 'none declared'}`,
    `Study hours per day: ${input.studyHoursPerDay ?? 'unspecified'}`,
    `Skill matrix:\n${skills}`,
    input.assignment ? assignmentBlock(input.assignment) : 'No completed assignment.',
  ];
  return `Build the roadmap for this student:\n\n${blocks.join('\n\n')}\n\nReturn ONLY the JSON object.`;
}

export const aiGenerator: RoadmapGenerator = {
  id: 'ai-v1',
  async generate(input: GeneratorInput): Promise<RoadmapPlan> {
    const system = SYSTEM.replaceAll('{MIN}', String(env.ROADMAP_MIN_ITEMS_PER_WEEK))
      .replaceAll('{MAX}', String(env.ROADMAP_MAX_ITEMS_PER_WEEK))
      .replaceAll('{MAXWEEKS}', String(env.ROADMAP_MAX_WEEKS));

    try {
      const plan = await generateJson({
        system,
        user: buildUserPrompt(input),
        schema: roadmapPlanSchema,
        temperature: 0.4,
      });
      // The model can declare a totalWeeks it doesn't actually write, or exceed the
      // cap. Trust the weeks it produced: renumber 1..N, clamp, and sync totalWeeks.
      const weeks = plan.weeks
        .slice(0, env.ROADMAP_MAX_WEEKS)
        .map((week, i) => ({ ...week, weekNumber: i + 1 }));
      return { totalWeeks: weeks.length, weeks, notes: plan.notes };
    } catch (err) {
      if (err instanceof AiError) {
        logger.warn({ userId: input.userId, code: err.code }, 'roadmap.ai.fallback_to_default');
        return defaultGenerator.generate(input);
      }
      throw err;
    }
  },
};
