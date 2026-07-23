import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type {
  CodingDifficulty,
  CodingLanguage,
  CodingQuestionInput,
  CodingSubmissionStatus,
  CodingTestCaseView,
  CodingTestResultView,
} from '@mentra/shared';
import { db } from '../../db.js';
import { createId } from '../../core/id.js';

// --- Row types ---

export type CodingTaskRow = {
  id: string;
  title: string;
  description: string;
  difficulty: CodingDifficulty;
  createdBy: string;
  visible: 0 | 1 | boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CodingQuestionRow = {
  id: string;
  taskId: string;
  sortOrder: number;
  title: string;
  description: string;
  languages: CodingLanguage[];
  starterCode: string;
  testCases: CodingTestCaseView[];
};

export type CodingSubmissionRow = {
  id: string;
  taskId: string;
  questionId: string;
  userId: string;
  language: CodingLanguage;
  code: string;
  status: CodingSubmissionStatus;
  passedCount: number;
  totalCount: number;
  percent: number;
  results: CodingTestResultView[];
  aiFeedback: string | null;
  aiModel: string | null;
  createdAt: Date;
};

// mysql2 returns JSON columns pre-parsed, but a stored string can slip through — normalize.
function asJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

// --- Tasks ---

const TASK_COLS =
  '`id`, `title`, `description`, `difficulty`, `createdBy`, `visible`, `sortOrder`, `createdAt`, `updatedAt`';

function toTaskRow(row: CodingTaskRow & RowDataPacket): CodingTaskRow {
  return { ...row, visible: Boolean(row.visible) };
}

export async function listAllTasks(): Promise<CodingTaskRow[]> {
  const [rows] = await db.execute<(CodingTaskRow & RowDataPacket)[]>(
    `SELECT ${TASK_COLS} FROM \`CodingTask\` ORDER BY \`sortOrder\`, \`createdAt\` DESC`,
  );
  return rows.map(toTaskRow);
}

export async function listVisibleTasks(): Promise<CodingTaskRow[]> {
  const [rows] = await db.execute<(CodingTaskRow & RowDataPacket)[]>(
    `SELECT ${TASK_COLS} FROM \`CodingTask\` WHERE \`visible\` = 1 ORDER BY \`sortOrder\`, \`createdAt\` DESC`,
  );
  return rows.map(toTaskRow);
}

export async function findTaskById(id: string): Promise<CodingTaskRow | null> {
  const [rows] = await db.execute<(CodingTaskRow & RowDataPacket)[]>(
    `SELECT ${TASK_COLS} FROM \`CodingTask\` WHERE \`id\` = :id LIMIT 1`,
    { id },
  );
  const row = rows[0];
  return row ? toTaskRow(row) : null;
}

// --- Questions ---

const QUESTION_COLS =
  '`id`, `taskId`, `sortOrder`, `title`, `description`, `languages`, `starterCode`, `testCases`';

function toQuestionRow(row: CodingQuestionRow & RowDataPacket): CodingQuestionRow {
  return {
    ...row,
    languages: asJson<CodingLanguage[]>(row.languages, []),
    testCases: asJson<CodingTestCaseView[]>(row.testCases, []),
  };
}

export async function listQuestionsByTask(taskId: string): Promise<CodingQuestionRow[]> {
  const [rows] = await db.execute<(CodingQuestionRow & RowDataPacket)[]>(
    `SELECT ${QUESTION_COLS} FROM \`CodingQuestion\` WHERE \`taskId\` = :taskId ORDER BY \`sortOrder\``,
    { taskId },
  );
  return rows.map(toQuestionRow);
}

/** Every question across all tasks (manager list groups these by taskId to avoid N+1). */
export async function listAllQuestions(): Promise<CodingQuestionRow[]> {
  const [rows] = await db.execute<(CodingQuestionRow & RowDataPacket)[]>(
    `SELECT ${QUESTION_COLS} FROM \`CodingQuestion\` ORDER BY \`taskId\`, \`sortOrder\``,
  );
  return rows.map(toQuestionRow);
}

export async function findQuestionById(id: string): Promise<CodingQuestionRow | null> {
  const [rows] = await db.execute<(CodingQuestionRow & RowDataPacket)[]>(
    `SELECT ${QUESTION_COLS} FROM \`CodingQuestion\` WHERE \`id\` = :id LIMIT 1`,
    { id },
  );
  const row = rows[0];
  return row ? toQuestionRow(row) : null;
}

// --- Task write (task + its questions in one transaction) ---

export type NewTask = {
  title: string;
  description: string;
  difficulty: CodingDifficulty;
  visible: boolean;
  createdBy: string;
};

function insertQuestionRows(
  conn: Awaited<ReturnType<typeof db.getConnection>>,
  taskId: string,
  questions: CodingQuestionInput[],
): Promise<unknown> {
  return questions.reduce<Promise<unknown>>(async (prev, q, i) => {
    await prev;
    return conn.execute(
      'INSERT INTO `CodingQuestion` (`id`, `taskId`, `sortOrder`, `title`, `description`, `languages`, `starterCode`, `testCases`) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        createId(),
        taskId,
        i,
        q.title,
        q.description,
        JSON.stringify(q.languages),
        q.starterCode,
        JSON.stringify(q.testCases),
      ],
    );
  }, Promise.resolve());
}

export async function insertTaskWithQuestions(
  task: NewTask,
  questions: CodingQuestionInput[],
): Promise<string> {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [maxRows] = await conn.execute<(RowDataPacket & { n: number })[]>(
      'SELECT COALESCE(MAX(`sortOrder`), 0) AS n FROM `CodingTask`',
    );
    const sortOrder = Number(maxRows[0]?.n ?? 0) + 1;
    const id = createId();
    await conn.execute(
      'INSERT INTO `CodingTask` (`id`, `title`, `description`, `difficulty`, `createdBy`, `visible`, `sortOrder`) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, task.title, task.description, task.difficulty, task.createdBy, task.visible ? 1 : 0, sortOrder],
    );
    await insertQuestionRows(conn, id, questions);
    await conn.commit();
    return id;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Update task meta and (optionally) REPLACE its whole question set in one transaction.
 * When `questions` is provided the old questions are deleted and reinserted; existing
 * submissions are kept (they reference stable questionIds only for display, so on a full
 * replace their questionTitle may fall back to the task — acceptable for an edit).
 */
export async function updateTaskWithQuestions(
  id: string,
  patch: Partial<NewTask>,
  questions?: CodingQuestionInput[],
): Promise<void> {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const sets: string[] = [];
    const params: (string | number)[] = [];
    if (patch.title !== undefined) {
      sets.push('`title` = ?');
      params.push(patch.title);
    }
    if (patch.description !== undefined) {
      sets.push('`description` = ?');
      params.push(patch.description);
    }
    if (patch.difficulty !== undefined) {
      sets.push('`difficulty` = ?');
      params.push(patch.difficulty);
    }
    if (patch.visible !== undefined) {
      sets.push('`visible` = ?');
      params.push(patch.visible ? 1 : 0);
    }
    if (sets.length > 0) {
      sets.push('`updatedAt` = NOW(3)');
      await conn.execute(`UPDATE \`CodingTask\` SET ${sets.join(', ')} WHERE \`id\` = ?`, [...params, id]);
    }
    if (questions) {
      await conn.execute('DELETE FROM `CodingQuestion` WHERE `taskId` = ?', [id]);
      await insertQuestionRows(conn, id, questions);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function deleteTask(id: string): Promise<void> {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM `CodingSubmission` WHERE `taskId` = ?', [id]);
    await conn.execute('DELETE FROM `CodingQuestion` WHERE `taskId` = ?', [id]);
    await conn.execute('DELETE FROM `CodingTask` WHERE `id` = ?', [id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// --- Submissions ---

const SUBMISSION_COLS =
  '`id`, `taskId`, `questionId`, `userId`, `language`, `code`, `status`, `passedCount`, `totalCount`, `percent`, `results`, `aiFeedback`, `aiModel`, `createdAt`';

function toSubmissionRow(row: CodingSubmissionRow & RowDataPacket): CodingSubmissionRow {
  return { ...row, results: asJson<CodingTestResultView[]>(row.results, []) };
}

export type NewSubmission = {
  taskId: string;
  questionId: string;
  userId: string;
  language: CodingLanguage;
  code: string;
  status: CodingSubmissionStatus;
  passedCount: number;
  totalCount: number;
  percent: number;
  results: CodingTestResultView[];
  aiFeedback: string | null;
  aiModel: string | null;
};

export async function insertSubmission(input: NewSubmission): Promise<string> {
  const id = createId();
  await db.execute<ResultSetHeader>(
    'INSERT INTO `CodingSubmission` (`id`, `taskId`, `questionId`, `userId`, `language`, `code`, `status`, `passedCount`, `totalCount`, `percent`, `results`, `aiFeedback`, `aiModel`) ' +
      'VALUES (:id, :taskId, :questionId, :userId, :language, :code, :status, :passedCount, :totalCount, :percent, :results, :aiFeedback, :aiModel)',
    {
      id,
      taskId: input.taskId,
      questionId: input.questionId,
      userId: input.userId,
      language: input.language,
      code: input.code,
      status: input.status,
      passedCount: input.passedCount,
      totalCount: input.totalCount,
      percent: input.percent,
      results: JSON.stringify(input.results),
      aiFeedback: input.aiFeedback,
      aiModel: input.aiModel,
    },
  );
  return id;
}

export async function findSubmissionById(id: string): Promise<CodingSubmissionRow | null> {
  const [rows] = await db.execute<(CodingSubmissionRow & RowDataPacket)[]>(
    `SELECT ${SUBMISSION_COLS} FROM \`CodingSubmission\` WHERE \`id\` = :id LIMIT 1`,
    { id },
  );
  const row = rows[0];
  return row ? toSubmissionRow(row) : null;
}

/** The student's submissions for a whole task, newest first (service reduces to latest-per-question). */
export async function listSubmissionsForUserTask(
  userId: string,
  taskId: string,
): Promise<CodingSubmissionRow[]> {
  const [rows] = await db.execute<(CodingSubmissionRow & RowDataPacket)[]>(
    `SELECT ${SUBMISSION_COLS} FROM \`CodingSubmission\` ` +
      'WHERE `userId` = :userId AND `taskId` = :taskId ORDER BY `createdAt` DESC',
    { userId, taskId },
  );
  return rows.map(toSubmissionRow);
}

export type StudentTaskStat = { attempted: number; solved: number };

/** Per-task roll-up of the student's own submissions: distinct questions attempted / solved. */
export async function statsForStudentByTask(userId: string): Promise<Map<string, StudentTaskStat>> {
  const [rows] = await db.execute<
    (RowDataPacket & { taskId: string; attempted: number; solved: number })[]
  >(
    'SELECT `taskId`, COUNT(DISTINCT `questionId`) AS attempted, ' +
      "COUNT(DISTINCT CASE WHEN `status` = 'passed' THEN `questionId` END) AS solved " +
      'FROM `CodingSubmission` WHERE `userId` = :userId GROUP BY `taskId`',
    { userId },
  );
  const map = new Map<string, StudentTaskStat>();
  for (const r of rows) map.set(r.taskId, { attempted: Number(r.attempted), solved: Number(r.solved) });
  return map;
}

export type TaskAggregate = { submissions: number; students: number };

/** Per-task aggregate across ALL students: total submissions + distinct students. */
export async function aggregateByTask(): Promise<Map<string, TaskAggregate>> {
  const [rows] = await db.execute<
    (RowDataPacket & { taskId: string; submissions: number; students: number })[]
  >(
    'SELECT `taskId`, COUNT(*) AS submissions, COUNT(DISTINCT `userId`) AS students ' +
      'FROM `CodingSubmission` GROUP BY `taskId`',
  );
  const map = new Map<string, TaskAggregate>();
  for (const r of rows) map.set(r.taskId, { submissions: Number(r.submissions), students: Number(r.students) });
  return map;
}

/** Per (task, user): how many distinct questions they've solved — used to count full completions. */
export async function passedQuestionsByTaskUser(): Promise<
  { taskId: string; userId: string; passedQuestions: number }[]
> {
  const [rows] = await db.execute<
    (RowDataPacket & { taskId: string; userId: string; passedQuestions: number })[]
  >(
    "SELECT `taskId`, `userId`, COUNT(DISTINCT `questionId`) AS passedQuestions " +
      "FROM `CodingSubmission` WHERE `status` = 'passed' GROUP BY `taskId`, `userId`",
  );
  return rows.map((r) => ({ taskId: r.taskId, userId: r.userId, passedQuestions: Number(r.passedQuestions) }));
}

/** Question count per task (all tasks). */
export async function questionCountByTask(): Promise<Map<string, number>> {
  const [rows] = await db.execute<(RowDataPacket & { taskId: string; n: number })[]>(
    'SELECT `taskId`, COUNT(*) AS n FROM `CodingQuestion` GROUP BY `taskId`',
  );
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.taskId, Number(r.n));
  return map;
}

/** Total questions belonging to currently-visible tasks (denominator for student progress). */
export async function countVisibleQuestions(): Promise<number> {
  const [rows] = await db.execute<(RowDataPacket & { n: number })[]>(
    'SELECT COUNT(*) AS n FROM `CodingQuestion` q ' +
      'JOIN `CodingTask` t ON t.`id` = q.`taskId` WHERE t.`visible` = 1',
  );
  return Number(rows[0]?.n ?? 0);
}

export type SubmissionWithMeta = CodingSubmissionRow & {
  studentName: string | null;
  studentEmail: string | null;
  questionTitle: string | null;
};

/** All submissions for a task with the student's name/email + question title joined in. */
export async function listSubmissionsForTask(taskId: string): Promise<SubmissionWithMeta[]> {
  const [rows] = await db.execute<(SubmissionWithMeta & RowDataPacket)[]>(
    'SELECT ' +
      SUBMISSION_COLS.split(', ')
        .map((c) => `s.${c}`)
        .join(', ') +
      ', u.`name` AS studentName, u.`email` AS studentEmail, q.`title` AS questionTitle ' +
      'FROM `CodingSubmission` s ' +
      'LEFT JOIN `User` u ON u.`id` = s.`userId` ' +
      'LEFT JOIN `CodingQuestion` q ON q.`id` = s.`questionId` ' +
      'WHERE s.`taskId` = :taskId ORDER BY s.`createdAt` DESC',
    { taskId },
  );
  return rows.map((r) => ({
    ...toSubmissionRow(r),
    studentName: r.studentName,
    studentEmail: r.studentEmail,
    questionTitle: r.questionTitle,
  }));
}
