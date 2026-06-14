import type { StudentProfileView } from '@mentra/shared';
import { assignmentSpecSchema, type AssignmentSpec } from '@mentra/shared';
import { generateJson } from '../../core/ai.js';

/**
 * Build a personalized assignment for a student from their profile. One AI call;
 * the caller caches the result so this never runs twice for the same student.
 */

const SYSTEM = `You are an assessment designer for a software-engineering career platform.
You design a short, personalized onboarding assignment that calibrates one specific student.
RULES:
- Respond with a SINGLE JSON object ONLY. No markdown, no prose, no code fences.
- The JSON MUST match this exact shape:
  {
    "summary": string,                       // 1-2 sentences on what this assignment evaluates for THIS student
    "tasks": [                               // 6 to 8 tasks, mixed types, ordered easy -> hard
      {
        "key": string,                       // unique slug, e.g. "mcq-closures"
        "type": "mcq" | "practice" | "short_answer",
        "title": string,
        "prompt": string,                    // the question / task statement
        "skillIds": string[],                // lowercase skill slugs this task probes, e.g. ["javascript","dsa"]
        "options": string[],                 // REQUIRED for "mcq" (3-4 options); OMIT for other types
        "correctIndex": number,              // REQUIRED for "mcq": 0-based index of the correct option; OMIT otherwise
        "estimatedMin": number               // realistic minutes to complete
      }
    ],
    "closingQuestions": [                     // 3 general reflection questions asked AFTER the tasks
      { "key": string, "prompt": string }     // used later to generate the student's roadmap
    ]
  }
GUIDELINES:
- Calibrate difficulty to the student's stated experience and tech stack. A beginner gets fundamentals; an experienced dev gets depth and trade-offs.
- Include at least 3 "mcq" (auto-scored), 2 "practice" (hands-on, self-marked), and 1 "short_answer".
- "mcq" options must be plausible and exactly one correct. Never reveal the answer in the prompt.
- closingQuestions should surface goals, constraints, and self-perceived weak areas (e.g. available time, target timeline, topics they avoid).
- Keep everything concrete and specific to this student. No filler.`;

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
  return generateJson({ system: SYSTEM, user, schema: assignmentSpecSchema, temperature: 0.5 });
}
