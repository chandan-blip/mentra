import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { AssignmentResponses, AssignmentSpec, AssignmentStatus } from '@mentra/shared';
import { db } from '../../db.js';
import { createId } from '../../core/id.js';

export type AssignmentRow = {
  id: string;
  userId: string;
  status: AssignmentStatus;
  model: string;
  spec: AssignmentSpec;
  responses: AssignmentResponses | null;
  score: number | null;
  createdAt: Date;
  completedAt: Date | null;
};

const COLS = '`id`, `userId`, `status`, `model`, `spec`, `responses`, `score`, `createdAt`, `completedAt`';

/** mysql2 returns JSON columns pre-parsed, but a stored string sneaks through as
 *  string — normalize defensively so callers always get objects. */
function hydrate(row: (AssignmentRow & RowDataPacket) | undefined): AssignmentRow | null {
  if (!row) return null;
  return {
    ...row,
    spec: typeof row.spec === 'string' ? (JSON.parse(row.spec) as AssignmentSpec) : row.spec,
    responses:
      typeof row.responses === 'string'
        ? (JSON.parse(row.responses) as AssignmentResponses)
        : row.responses,
  };
}

export async function createAssignment(input: {
  userId: string;
  model: string;
  spec: AssignmentSpec;
}): Promise<string> {
  const id = createId();
  await db.execute<ResultSetHeader>(
    'INSERT INTO `Assignment` (`id`, `userId`, `status`, `model`, `spec`) VALUES (:id, :userId, \'ready\', :model, :spec)',
    { id, userId: input.userId, model: input.model, spec: JSON.stringify(input.spec) },
  );
  return id;
}

/** The open (not-yet-completed) assignment, if any. Its existence is the AI-cache guard. */
export async function findOpenByUser(userId: string): Promise<AssignmentRow | null> {
  const [rows] = await db.execute<(AssignmentRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`Assignment\` WHERE \`userId\` = :userId AND \`status\` = 'ready' LIMIT 1`,
    { userId },
  );
  return hydrate(rows[0]);
}

/** The most recent assignment regardless of status (used to read completed results). */
export async function findLatestByUser(userId: string): Promise<AssignmentRow | null> {
  const [rows] = await db.execute<(AssignmentRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`Assignment\` WHERE \`userId\` = :userId ORDER BY \`createdAt\` DESC LIMIT 1`,
    { userId },
  );
  return hydrate(rows[0]);
}

export async function markCompleted(
  id: string,
  responses: AssignmentResponses,
  score: number | null,
): Promise<void> {
  await db.execute<ResultSetHeader>(
    "UPDATE `Assignment` SET `status` = 'completed', `responses` = :responses, `score` = :score, `completedAt` = NOW(3) WHERE `id` = :id",
    { id, responses: JSON.stringify(responses), score },
  );
}
