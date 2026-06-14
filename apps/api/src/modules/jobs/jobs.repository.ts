import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type {
  CreateJobInput,
  JobEmploymentType,
  JobExperience,
  JobLocationType,
  JobSource,
  JobStatus,
  UpdateJobInput,
} from '@mentra/shared';
import { db, type SqlParams } from '../../db.js';
import { createId } from '../../core/id.js';

export type JobRow = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  locationType: JobLocationType;
  employmentType: JobEmploymentType;
  experienceLevel: JobExperience;
  description: string;
  // mysql2 returns JSON columns already parsed; tolerate a raw string just in case.
  skills: string[] | string | null;
  targetRole: string | null;
  salary: string | null;
  applyUrl: string | null;
  source: JobSource;
  createdBy: string | null;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
};

const COLS =
  '`id`, `title`, `company`, `location`, `locationType`, `employmentType`, `experienceLevel`, ' +
  '`description`, `skills`, `targetRole`, `salary`, `applyUrl`, `source`, `createdBy`, `status`, ' +
  '`createdAt`, `updatedAt`';

/** A new posting to insert (HR-authored or AI-discovered). */
export type NewJob = CreateJobInput & { source: JobSource; createdBy: string | null };

export async function insertJob(input: NewJob): Promise<JobRow> {
  const id = createId();
  await db.execute<ResultSetHeader>(
    'INSERT INTO `Job` (`id`, `title`, `company`, `location`, `locationType`, `employmentType`, ' +
      '`experienceLevel`, `description`, `skills`, `targetRole`, `salary`, `applyUrl`, `source`, `createdBy`) ' +
      'VALUES (:id, :title, :company, :location, :locationType, :employmentType, :experienceLevel, ' +
      ':description, :skills, :targetRole, :salary, :applyUrl, :source, :createdBy)',
    {
      id,
      title: input.title,
      company: input.company,
      location: input.location ?? null,
      locationType: input.locationType,
      employmentType: input.employmentType,
      experienceLevel: input.experienceLevel,
      description: input.description,
      skills: JSON.stringify(input.skills ?? []),
      targetRole: input.targetRole ?? null,
      salary: input.salary ?? null,
      applyUrl: input.applyUrl ?? null,
      source: input.source,
      createdBy: input.createdBy,
    },
  );
  const created = await findById(id);
  if (!created) throw new Error('failed to read back created job');
  return created;
}

export async function findById(id: string): Promise<JobRow | null> {
  const [rows] = await db.execute<(JobRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`Job\` WHERE \`id\` = :id LIMIT 1`,
    { id },
  );
  return rows[0] ?? null;
}

/** Open postings, newest first — the student board. */
export async function listOpen(limit = 200): Promise<JobRow[]> {
  const [rows] = await db.query<(JobRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`Job\` WHERE \`status\` = 'open' ORDER BY \`createdAt\` DESC LIMIT ?`,
    [limit],
  );
  return rows;
}

/** Every posting (open + closed), newest first — the HR management list. */
export async function listAll(limit = 300): Promise<JobRow[]> {
  const [rows] = await db.query<(JobRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`Job\` ORDER BY \`createdAt\` DESC LIMIT ?`,
    [limit],
  );
  return rows;
}

/** Dedupe guard for AI ingest: skip a posting we already have (same title + company). */
export async function existsByTitleCompany(title: string, company: string): Promise<boolean> {
  const [rows] = await db.execute<({ id: string } & RowDataPacket)[]>(
    'SELECT `id` FROM `Job` WHERE LOWER(`title`) = LOWER(:title) AND LOWER(`company`) = LOWER(:company) LIMIT 1',
    { title, company },
  );
  return rows.length > 0;
}

/** Columns an HR update is allowed to touch. Acts as a SQL-injection allowlist. */
const WRITABLE = new Set([
  'title',
  'company',
  'location',
  'locationType',
  'employmentType',
  'experienceLevel',
  'description',
  'skills',
  'targetRole',
  'salary',
  'applyUrl',
  'status',
]);

export async function updateJob(id: string, fields: UpdateJobInput): Promise<void> {
  const entries = Object.entries(fields).filter(([col]) => WRITABLE.has(col));
  if (entries.length === 0) return;
  const params: SqlParams = { id };
  const sets = entries.map(([col, value]) => {
    params[col] = col === 'skills' ? JSON.stringify(value ?? []) : ((value ?? null) as SqlParams[string]);
    return `\`${col}\` = :${col}`;
  });
  await db.execute<ResultSetHeader>(`UPDATE \`Job\` SET ${sets.join(', ')} WHERE \`id\` = :id`, params);
}

export async function deleteJob(id: string): Promise<void> {
  await db.execute<ResultSetHeader>('DELETE FROM `Job` WHERE `id` = :id', { id });
}
