import type {
  AssignmentResponses,
  AssignmentSpec,
  AssignmentStatusView,
  AssignmentSubmission,
  AssignmentView,
} from '@mentra/shared';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { emit } from '../../core/events.js';
import { getProfile } from '../user-profile/index.js';
import { buildAssignmentSpec } from './assignment.ai.js';
import { AssignmentError } from './assignment.errors.js';
import {
  type AssignmentRow,
  createAssignment,
  findLatestByUser,
  findOpenByUser,
  markCompleted,
} from './assignment.repository.js';

/** Result of a completed assignment, shaped for the roadmap generator. */
export type AssignmentResult = {
  summary: string;
  score: number | null;
  tasks: { title: string; type: string; skillIds: string[]; correct: boolean | null }[];
  closingAnswers: { prompt: string; answer: string }[];
};

/**
 * Return the student's assignment, generating it once via AI if none exists yet.
 * Idempotent and cached: if any assignment row already exists for the user we
 * return it untouched — the model is never called twice for the same student.
 */
export async function ensureAssignmentForUser(userId: string): Promise<AssignmentRow> {
  const existing = await findLatestByUser(userId);
  if (existing) return existing;

  const profile = await getProfile(userId);
  logger.info({ userId, model: env.AI_MODEL }, 'assignment.generation.requested');
  const spec = await buildAssignmentSpec(profile);

  let id: string;
  try {
    id = await createAssignment({ userId, model: env.AI_MODEL, spec });
  } catch (err) {
    // Lost a race against a concurrent generation (unique openKey). Use the winner.
    if (err && typeof err === 'object' && (err as { code?: string }).code === 'ER_DUP_ENTRY') {
      const winner = await findLatestByUser(userId);
      if (winner) return winner;
    }
    throw err;
  }

  logger.info({ userId, assignmentId: id, tasks: spec.tasks.length }, 'assignment.generation.succeeded');
  emit('assignment.generated', { userId, assignmentId: id });

  const created = await findLatestByUser(userId);
  if (!created) throw new AssignmentError('ASSIGNMENT_MISSING', 'Assignment vanished after create', 500);
  return created;
}

/** Strip the MCQ answer keys before sending the spec to the client. */
function toView(row: AssignmentRow): AssignmentView {
  return {
    id: row.id,
    status: row.status,
    summary: row.spec.summary,
    tasks: row.spec.tasks.map(({ correctIndex: _omit, ...task }) => task),
    closingQuestions: row.spec.closingQuestions,
    score: row.score,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

export async function getAssignmentView(userId: string): Promise<AssignmentView> {
  const row = await ensureAssignmentForUser(userId);
  return toView(row);
}

/** Lightweight status for dashboards/CTAs — never generates (no AI call). */
export async function getAssignmentStatus(userId: string): Promise<AssignmentStatusView> {
  const row = await findLatestByUser(userId);
  return { exists: Boolean(row), status: row?.status ?? null, score: row?.score ?? null };
}

/** Auto-score MCQs: percentage of MCQ tasks answered correctly, or null if none. */
function scoreMcq(spec: AssignmentSpec, responses: AssignmentResponses): number | null {
  const answerByKey = new Map(responses.taskAnswers.map((a) => [a.key, a.answer]));
  const mcqs = spec.tasks.filter((t) => t.type === 'mcq' && typeof t.correctIndex === 'number');
  if (mcqs.length === 0) return null;
  let correct = 0;
  for (const task of mcqs) {
    if (answerByKey.get(task.key) === task.correctIndex) correct += 1;
  }
  return Math.round((correct / mcqs.length) * 100);
}

export async function submitAssignment(
  userId: string,
  submission: AssignmentSubmission,
): Promise<AssignmentView> {
  const open = await findOpenByUser(userId);
  if (!open) {
    throw new AssignmentError('ASSIGNMENT_NOT_OPEN', 'No open assignment to submit', 409);
  }

  const validKeys = new Set(open.spec.tasks.map((t) => t.key));
  const validClosing = new Set(open.spec.closingQuestions.map((q) => q.key));
  const unknownTask = submission.taskAnswers.find((a) => !validKeys.has(a.key));
  if (unknownTask) {
    throw new AssignmentError('UNKNOWN_TASK', `Unknown task key: ${unknownTask.key}`, 400);
  }
  const unknownClosing = submission.closingAnswers.find((a) => !validClosing.has(a.key));
  if (unknownClosing) {
    throw new AssignmentError('UNKNOWN_QUESTION', `Unknown closing question key: ${unknownClosing.key}`, 400);
  }

  const responses: AssignmentResponses = {
    taskAnswers: submission.taskAnswers,
    closingAnswers: submission.closingAnswers,
  };
  const score = scoreMcq(open.spec, responses);

  await markCompleted(open.id, responses, score);
  logger.info({ userId, assignmentId: open.id, score }, 'assignment.completed');
  emit('assignment.completed', { userId, assignmentId: open.id, score: score ?? 0 });

  const updated = await findLatestByUser(userId);
  return toView(updated ?? { ...open, status: 'completed', responses, score, completedAt: new Date() });
}

/**
 * Cross-module export for the roadmap generator: the completed assignment's
 * results, or null if the student has not completed one yet.
 */
export async function getAssignmentResultForUser(userId: string): Promise<AssignmentResult | null> {
  const row = await findLatestByUser(userId);
  if (!row || row.status !== 'completed' || !row.responses) return null;

  const answerByKey = new Map(row.responses.taskAnswers.map((a) => [a.key, a.answer]));
  const closingByKey = new Map(row.responses.closingAnswers.map((a) => [a.key, a.answer]));

  return {
    summary: row.spec.summary,
    score: row.score,
    tasks: row.spec.tasks.map((t) => ({
      title: t.title,
      type: t.type,
      skillIds: t.skillIds,
      correct:
        t.type === 'mcq' && typeof t.correctIndex === 'number'
          ? answerByKey.get(t.key) === t.correctIndex
          : null,
    })),
    closingAnswers: row.spec.closingQuestions.map((q) => ({
      prompt: q.prompt,
      answer: String(closingByKey.get(q.key) ?? ''),
    })),
  };
}
