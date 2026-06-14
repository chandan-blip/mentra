import type {
  CreateJobInput,
  DiscoverJobsInput,
  HrDiscoverJobsInput,
  JobExperience,
  JobView,
  UpdateJobInput,
} from '@mentra/shared';
import { getProfile } from '../user-profile/index.js';
import { AiError } from '../../core/ai.js';
import { logger } from '../../logger.js';
import { JobError } from './jobs.errors.js';
import { generateJobs, type AiJob } from './jobs.ai.js';
import * as repo from './jobs.repository.js';

/** Module keys gating the two surfaces (match the frontend AppLayout guard). */
export const STUDENT_MODULE = 'jobs';
export const HR_MODULE = 'hr-jobs';

const iso = (d: Date): string => new Date(d).toISOString();

/** mysql2 usually parses the JSON column already; fall back to parsing a raw string. */
function readSkills(value: string[] | string | null): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toView(row: repo.JobRow, match?: { score: number; matchedSkills: string[] }): JobView {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    locationType: row.locationType,
    employmentType: row.employmentType,
    experienceLevel: row.experienceLevel,
    description: row.description,
    skills: readSkills(row.skills),
    targetRole: row.targetRole,
    salary: row.salary,
    applyUrl: row.applyUrl,
    source: row.source,
    status: row.status,
    createdAt: iso(row.createdAt),
    ...(match ? { matchScore: match.score, matchedSkills: match.matchedSkills } : {}),
  };
}

// --- Profile-based ranking ---

const SENIORITY_RANK: Record<JobExperience, number> = { entry: 0, mid: 1, senior: 2 };

/** Coarsely map a profile experience level to a job seniority bucket. */
function seniorityOf(level: string | null): JobExperience {
  switch (level) {
    case 'one_to_three':
      return 'mid';
    case 'three_to_five':
    case 'five_plus':
      return 'senior';
    default:
      return 'entry'; // none | intern | under_one | unknown
  }
}

function scoreJob(
  row: repo.JobRow,
  ctx: { skills: Set<string>; targetRoles: string[]; seniority: JobExperience; locationHints: string[] },
): { score: number; matchedSkills: string[] } {
  const jobSkills = readSkills(row.skills);
  const matchedSkills = jobSkills.filter((s) => ctx.skills.has(s.toLowerCase()));

  let score = 0;
  // Skill overlap is the dominant signal (up to 55 pts); jobs with no listed skills
  // get a small neutral base so they aren't buried entirely.
  score += jobSkills.length ? Math.round((matchedSkills.length / jobSkills.length) * 55) : 10;

  // Target-role match against the title or the posting's own role label (25 pts).
  const haystack = `${row.title} ${row.targetRole ?? ''}`.toLowerCase();
  if (ctx.targetRoles.some((r) => r && haystack.includes(r.toLowerCase()))) score += 25;

  // Seniority fit: exact +12, one bucket away +6 (12 pts).
  const gap = Math.abs(SENIORITY_RANK[row.experienceLevel] - SENIORITY_RANK[ctx.seniority]);
  if (gap === 0) score += 12;
  else if (gap === 1) score += 6;

  // Location fit (8 pts): remote always counts; otherwise match city/country text.
  if (row.locationType === 'remote') score += 8;
  else if (ctx.locationHints.some((h) => h && (row.location ?? '').toLowerCase().includes(h.toLowerCase()))) {
    score += 8;
  }

  return { score: Math.min(100, score), matchedSkills };
}

/** The student job board, ranked by fit against the requester's profile. */
export async function listForStudent(userId: string): Promise<JobView[]> {
  const [profile, rows] = await Promise.all([getProfile(userId), repo.listOpen()]);
  const ctx = {
    skills: new Set(profile.techStack.map((s) => s.toLowerCase())),
    targetRoles: profile.targetRoles,
    seniority: seniorityOf(profile.experienceLevel),
    locationHints: [profile.city, profile.country].filter((v): v is string => Boolean(v)),
  };
  return rows
    .map((r) => toView(r, scoreJob(r, ctx)))
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
}

// --- AI discovery ---

/** Insert AI-discovered postings, skipping duplicates. Returns the count inserted. */
async function persist(aiJobs: AiJob[]): Promise<number> {
  let created = 0;
  for (const j of aiJobs) {
    if (await repo.existsByTitleCompany(j.title, j.company)) continue;
    await repo.insertJob({ ...j, source: 'ai', createdBy: null });
    created += 1;
  }
  return created;
}

function wrapAiError(err: unknown): never {
  if (err instanceof AiError) {
    logger.error({ err }, 'job discovery failed');
    throw new JobError('AI_FAILED', 'Could not fetch jobs from the web right now. Please try again.', 502);
  }
  throw err;
}

/** Student-triggered discovery, scoped to their own profile. */
export async function discoverForStudent(userId: string, input: DiscoverJobsInput): Promise<{ created: number }> {
  const profile = await getProfile(userId);
  const location = [profile.city, profile.country].filter(Boolean).join(', ') || null;
  let aiJobs: AiJob[];
  try {
    aiJobs = await generateJobs({
      count: input.count,
      role: profile.targetRoles[0] ?? profile.currentRole ?? undefined,
      skills: profile.techStack,
      location,
      experienceLevel: profile.experienceLevel,
      goal: profile.goal,
    });
  } catch (err) {
    wrapAiError(err);
  }
  return { created: await persist(aiJobs) };
}

// --- HR management ---

export async function listForHr(): Promise<JobView[]> {
  const rows = await repo.listAll();
  return rows.map((r) => toView(r));
}

export async function createJob(userId: string, input: CreateJobInput): Promise<JobView> {
  const row = await repo.insertJob({ ...input, source: 'hr', createdBy: userId });
  return toView(row);
}

export async function updateJob(_userId: string, id: string, input: UpdateJobInput): Promise<JobView> {
  const existing = await repo.findById(id);
  if (!existing) throw new JobError('JOB_NOT_FOUND', 'Job not found', 404);
  await repo.updateJob(id, input);
  const updated = await repo.findById(id);
  return toView(updated!);
}

export async function deleteJob(_userId: string, id: string): Promise<void> {
  const existing = await repo.findById(id);
  if (!existing) throw new JobError('JOB_NOT_FOUND', 'Job not found', 404);
  await repo.deleteJob(id);
}

/** HR-triggered discovery for a role/skill set of their choosing. */
export async function discoverForHr(_userId: string, input: HrDiscoverJobsInput): Promise<{ created: number }> {
  let aiJobs: AiJob[];
  try {
    aiJobs = await generateJobs({ count: input.count, role: input.role, skills: input.skills });
  } catch (err) {
    wrapAiError(err);
  }
  return { created: await persist(aiJobs) };
}
