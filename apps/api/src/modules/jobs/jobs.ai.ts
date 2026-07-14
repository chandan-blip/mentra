import { z } from 'zod';
import { JobEmploymentTypeSchema, JobExperienceSchema, JobLocationTypeSchema } from '@mentra/shared';
import { generateJson } from '../../core/ai.js';
import { getPromptConfig } from '../ai-prompt/ai-prompt.service.js';
import { PROMPT_KEYS } from '../ai-prompt/ai-prompt.registry.js';

/**
 * AI job ingest. Given a profile (or an HR-chosen role/skill set) the model
 * researches the current job market and returns realistic, applyable openings.
 * Output is forced to JSON and validated here before the service caches it in the
 * `Job` table — we never call the model speculatively (callers trigger it explicitly).
 *
 * NOTE: the model researches from its own market knowledge rather than fetching live
 * pages. To wire a true web search, replace the `generateJson` call below with a
 * search-provider call (e.g. a tool-enabled model) that returns the same shape — the
 * rest of the pipeline (validation, dedupe, persistence) stays unchanged.
 */

// Lenient on enums/optionals: a single off-spec field shouldn't drop the whole batch.
const aiJobSchema = z.object({
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).nullable().catch(null),
  locationType: JobLocationTypeSchema.catch('onsite'),
  employmentType: JobEmploymentTypeSchema.catch('full-time'),
  experienceLevel: JobExperienceSchema.catch('entry'),
  description: z.string().trim().min(1).max(4000),
  skills: z.array(z.string().trim().min(1).max(60)).max(20).catch([]),
  targetRole: z.string().trim().max(120).nullable().catch(null),
  salary: z.string().trim().max(120).nullable().catch(null),
  applyUrl: z.string().trim().max(500).nullable().catch(null),
});
export type AiJob = z.infer<typeof aiJobSchema>;

const aiBatchSchema = z.object({ jobs: z.array(aiJobSchema).max(20) });

export async function generateJobs(input: {
  count: number;
  role?: string;
  skills?: string[];
  location?: string | null;
  experienceLevel?: string | null;
  goal?: string | null;
}): Promise<AiJob[]> {
  const user = [
    `Generate ${input.count} distinct job openings.`,
    input.role ? `Primary target role: ${input.role}.` : '',
    input.skills?.length ? `Candidate skills: ${input.skills.join(', ')}.` : '',
    input.location ? `Preferred location: ${input.location} (also include some remote roles).` : '',
    input.experienceLevel ? `Candidate seniority: ${input.experienceLevel}.` : '',
    input.goal ? `Career goal: ${input.goal}.` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const cfg = await getPromptConfig(PROMPT_KEYS.jobsGenerate);
  const { jobs } = await generateJson({
    system: cfg.system,
    user,
    schema: aiBatchSchema,
    temperature: cfg.temperature,
  });
  return jobs;
}
