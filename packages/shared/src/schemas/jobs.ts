import { z } from 'zod';

/**
 * Jobs — a personalized job board for students and an HR posting surface. Postings
 * live in the `Job` table; each is either AI-discovered from the live job market
 * (`source: 'ai'`) or posted by an HR user (`source: 'hr'`). The student board ranks
 * postings against the student's profile (tech stack, target roles, seniority).
 * These schemas are the FE+BE contract.
 */

export const JobLocationTypeSchema = z.enum(['onsite', 'remote', 'hybrid']);
export type JobLocationType = z.infer<typeof JobLocationTypeSchema>;

export const JobEmploymentTypeSchema = z.enum(['full-time', 'part-time', 'internship', 'contract']);
export type JobEmploymentType = z.infer<typeof JobEmploymentTypeSchema>;

/** Seniority bucket — kept coarse so it lines up with profile experience levels. */
export const JobExperienceSchema = z.enum(['entry', 'mid', 'senior']);
export type JobExperience = z.infer<typeof JobExperienceSchema>;

export const JobSourceSchema = z.enum(['ai', 'hr']);
export type JobSource = z.infer<typeof JobSourceSchema>;

export const JobStatusSchema = z.enum(['open', 'closed']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

const jobSkillsSchema = z.array(z.string().trim().min(1).max(60)).max(30).default([]);

/** HR creates a posting. */
export const createJobSchema = z.object({
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).nullable().optional(),
  locationType: JobLocationTypeSchema.default('onsite'),
  employmentType: JobEmploymentTypeSchema.default('full-time'),
  experienceLevel: JobExperienceSchema.default('entry'),
  description: z.string().trim().min(1).max(8000),
  skills: jobSkillsSchema,
  targetRole: z.string().trim().max(120).nullable().optional(),
  salary: z.string().trim().max(120).nullable().optional(),
  applyUrl: z.string().trim().max(500).nullable().optional(),
});
export type CreateJobInput = z.infer<typeof createJobSchema>;

/** HR edits a posting (any subset of fields, plus open/close). */
export const updateJobSchema = createJobSchema.partial().extend({
  status: JobStatusSchema.optional(),
});
export type UpdateJobInput = z.infer<typeof updateJobSchema>;

/** Student asks the AI to discover fresh openings matched to their profile. */
export const discoverJobsSchema = z.object({
  count: z.number().int().min(1).max(20).default(8),
});
export type DiscoverJobsInput = z.infer<typeof discoverJobsSchema>;

/** HR asks the AI to discover openings for a role/skill set of their choosing. */
export const hrDiscoverJobsSchema = z.object({
  count: z.number().int().min(1).max(20).default(8),
  role: z.string().trim().max(120).optional(),
  skills: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
});
export type HrDiscoverJobsInput = z.infer<typeof hrDiscoverJobsSchema>;

// --- Views returned by the API ---

export type JobView = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  locationType: JobLocationType;
  employmentType: JobEmploymentType;
  experienceLevel: JobExperience;
  description: string;
  skills: string[];
  targetRole: string | null;
  salary: string | null;
  applyUrl: string | null;
  source: JobSource;
  status: JobStatus;
  createdAt: string;
  /** Student board only: 0–100 fit score against the student's profile. */
  matchScore?: number;
  /** Student board only: the job's skills the student already has. */
  matchedSkills?: string[];
};

/** Result of an AI discovery run. */
export type JobDiscoveryResult = {
  /** New postings inserted (duplicates of existing title+company are skipped). */
  created: number;
};
