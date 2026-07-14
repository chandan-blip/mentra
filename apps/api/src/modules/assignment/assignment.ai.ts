import type { StudentProfileView } from '@mentra/shared';
import { assignmentSpecSchema, type AssignmentSpec } from '@mentra/shared';
import { generateJson } from '../../core/ai.js';
import { getPromptConfig } from '../ai-prompt/ai-prompt.service.js';
import { PROMPT_KEYS } from '../ai-prompt/ai-prompt.registry.js';

/**
 * Build a personalized assignment for a student from their profile. One AI call;
 * the caller caches the result so this never runs twice for the same student. The
 * system prompt is manager-tunable (see the ai-prompt module).
 */

function profileContext(profile: StudentProfileView): string {
  const lines = [
    `Experience level: ${profile.experienceLevel ?? 'unknown'}`,
    `Education: ${profile.educationLevel ?? 'unknown'}`,
    `Current role: ${profile.currentRole ?? 'none'}`,
    `Career goal: ${profile.goal ?? 'unspecified'}`,
    `Target roles: ${profile.targetRoles.length ? profile.targetRoles.join(', ') : 'unspecified'}`,
    `Tech stack / known skills: ${profile.techStack.length ? profile.techStack.join(', ') : 'none declared'}`,
    `Study hours per day: ${profile.studyHoursPerDay ?? 'unspecified'}`,
  ];
  return lines.join('\n');
}

export async function buildAssignmentSpec(profile: StudentProfileView): Promise<AssignmentSpec> {
  const user = `Design the onboarding assignment for this student:\n\n${profileContext(profile)}\n\nReturn ONLY the JSON object.`;
  const cfg = await getPromptConfig(PROMPT_KEYS.assignmentBuild);
  return generateJson({ system: cfg.system, user, schema: assignmentSpecSchema, temperature: cfg.temperature });
}
