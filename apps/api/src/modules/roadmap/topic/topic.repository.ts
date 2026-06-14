import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { RoadmapTestQuestionType, RoadmapTestStatus } from '@mentra/shared';
import { db } from '../../../db.js';
import { createId } from '../../../core/id.js';

// --- Row types ---

export type RoadmapSubtopicRow = {
  id: string;
  roadmapId: string;
  itemId: string;
  order: number;
  title: string;
  description: string | null;
  estimatedMin: number | null;
};

export type RoadmapTestRow = {
  id: string;
  userId: string;
  roadmapId: string;
  itemId: string;
  status: RoadmapTestStatus;
  model: string;
  totalQuestions: number;
  maxScore: number;
  passPercent: number;
  startedAt: Date | null;
  completedAt: Date | null;
};

export type RoadmapTestQuestionRow = {
  id: string;
  testId: string;
  subtopicId: string | null;
  order: number;
  type: RoadmapTestQuestionType;
  body: string;
  options: string[];
  correct: number[];
  explanation: string | null;
  points: number;
};

export type RoadmapTestResultRow = {
  id: string;
  userId: string;
  testId: string;
  roadmapId: string;
  itemId: string;
  attemptNumber: number;
  score: number;
  maxScore: number;
  percent: number;
  correctCount: number;
  totalQuestions: number;
  passed: 0 | 1 | boolean;
  createdAt: Date;
};

// mysql2 returns JSON columns pre-parsed, but a stored string can sneak through —
// normalize defensively so callers always get arrays.
function asArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

// --- Subtopics ---

export async function listSubtopicsByItem(itemId: string): Promise<RoadmapSubtopicRow[]> {
  const [rows] = await db.execute<(RoadmapSubtopicRow & RowDataPacket)[]>(
    'SELECT `id`, `roadmapId`, `itemId`, `order`, `title`, `description`, `estimatedMin` ' +
      'FROM `RoadmapSubtopic` WHERE `itemId` = :itemId ORDER BY `order`',
    { itemId },
  );
  return rows;
}

export async function insertSubtopics(input: {
  roadmapId: string;
  itemId: string;
  generatedBy: string;
  subtopics: { title: string; description?: string; estimatedMin?: number }[];
}): Promise<void> {
  if (input.subtopics.length === 0) return;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    let order = 0;
    for (const s of input.subtopics) {
      await conn.execute(
        'INSERT INTO `RoadmapSubtopic` (`id`, `roadmapId`, `itemId`, `order`, `title`, `description`, `estimatedMin`, `generatedBy`) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          createId(),
          input.roadmapId,
          input.itemId,
          order++,
          s.title,
          s.description ?? null,
          s.estimatedMin ?? null,
          input.generatedBy,
        ],
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// --- Tests ---

const TEST_COLS =
  '`id`, `userId`, `roadmapId`, `itemId`, `status`, `model`, `totalQuestions`, `maxScore`, `passPercent`, `startedAt`, `completedAt`';

/** The open (not-yet-completed) test for a topic, if any. This is the AI-cache guard. */
export async function findOpenTest(userId: string, itemId: string): Promise<RoadmapTestRow | null> {
  const [rows] = await db.execute<(RoadmapTestRow & RowDataPacket)[]>(
    `SELECT ${TEST_COLS} FROM \`RoadmapTest\` WHERE \`userId\` = :userId AND \`itemId\` = :itemId AND \`status\` <> 'completed' LIMIT 1`,
    { userId, itemId },
  );
  return rows[0] ?? null;
}

export async function findTestById(testId: string): Promise<RoadmapTestRow | null> {
  const [rows] = await db.execute<(RoadmapTestRow & RowDataPacket)[]>(
    `SELECT ${TEST_COLS} FROM \`RoadmapTest\` WHERE \`id\` = :id LIMIT 1`,
    { id: testId },
  );
  return rows[0] ?? null;
}

export async function listQuestions(testId: string): Promise<RoadmapTestQuestionRow[]> {
  const [rows] = await db.execute<(RoadmapTestQuestionRow & RowDataPacket)[]>(
    'SELECT `id`, `testId`, `subtopicId`, `order`, `type`, `body`, `options`, `correct`, `explanation`, `points` ' +
      'FROM `RoadmapTestQuestion` WHERE `testId` = :testId ORDER BY `order`',
    { testId },
  );
  return rows.map((r) => ({
    ...r,
    options: asArray<string>(r.options),
    correct: asArray<number>(r.correct),
  }));
}

export type NewQuestion = {
  subtopicId: string | null;
  type: RoadmapTestQuestionType;
  body: string;
  options: string[];
  correct: number[];
  explanation: string | null;
  points: number;
};

/** Persist a generated test + its questions atomically. Returns the new test id. */
export async function createTestWithQuestions(input: {
  userId: string;
  roadmapId: string;
  itemId: string;
  model: string;
  passPercent: number;
  questions: NewQuestion[];
}): Promise<string> {
  const conn = await db.getConnection();
  const testId = createId();
  const maxScore = input.questions.reduce((n, q) => n + q.points, 0);
  try {
    await conn.beginTransaction();
    await conn.execute(
      'INSERT INTO `RoadmapTest` (`id`, `userId`, `roadmapId`, `itemId`, `status`, `model`, `totalQuestions`, `maxScore`, `passPercent`) ' +
        "VALUES (?, ?, ?, ?, 'ready', ?, ?, ?, ?)",
      [
        testId,
        input.userId,
        input.roadmapId,
        input.itemId,
        input.model,
        input.questions.length,
        maxScore,
        input.passPercent,
      ],
    );
    let order = 0;
    for (const q of input.questions) {
      await conn.execute(
        'INSERT INTO `RoadmapTestQuestion` (`id`, `testId`, `subtopicId`, `order`, `type`, `body`, `options`, `correct`, `explanation`, `points`) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          createId(),
          testId,
          q.subtopicId,
          order++,
          q.type,
          q.body,
          JSON.stringify(q.options),
          JSON.stringify(q.correct),
          q.explanation,
          q.points,
        ],
      );
    }
    await conn.commit();
    return testId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function markTestInProgress(testId: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    "UPDATE `RoadmapTest` SET `status` = 'in_progress', `startedAt` = COALESCE(`startedAt`, NOW(3)) WHERE `id` = :id AND `status` = 'ready'",
    { id: testId },
  );
}

// --- Submission (answers + marks) ---

export type GradedAnswer = {
  questionId: string;
  selected: number[];
  isCorrect: boolean;
  pointsAwarded: number;
};

/**
 * Record a completed attempt atomically: store every answer, write the marks row
 * to `RoadmapTestResult`, and close the test. Returns the persisted result id.
 */
export async function recordAttempt(input: {
  test: RoadmapTestRow;
  answers: GradedAnswer[];
  attemptNumber: number;
  score: number;
  maxScore: number;
  percent: number;
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
}): Promise<string> {
  const conn = await db.getConnection();
  const resultId = createId();
  try {
    await conn.beginTransaction();
    // Answers are unique per (testId, questionId); clear any from a prior partial
    // submit on the same (still-open) test before re-inserting.
    await conn.execute('DELETE FROM `RoadmapTestAnswer` WHERE `testId` = ?', [input.test.id]);
    for (const a of input.answers) {
      await conn.execute(
        'INSERT INTO `RoadmapTestAnswer` (`id`, `testId`, `questionId`, `selected`, `isCorrect`, `pointsAwarded`) ' +
          'VALUES (?, ?, ?, ?, ?, ?)',
        [createId(), input.test.id, a.questionId, JSON.stringify(a.selected), a.isCorrect, a.pointsAwarded],
      );
    }
    await conn.execute(
      'INSERT INTO `RoadmapTestResult` (`id`, `userId`, `testId`, `roadmapId`, `itemId`, `attemptNumber`, `score`, `maxScore`, `percent`, `correctCount`, `totalQuestions`, `passed`) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        resultId,
        input.test.userId,
        input.test.id,
        input.test.roadmapId,
        input.test.itemId,
        input.attemptNumber,
        input.score,
        input.maxScore,
        input.percent,
        input.correctCount,
        input.totalQuestions,
        input.passed,
      ],
    );
    await conn.execute("UPDATE `RoadmapTest` SET `status` = 'completed', `completedAt` = NOW(3) WHERE `id` = ?", [
      input.test.id,
    ]);
    await conn.commit();
    return resultId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listResultsByItem(userId: string, itemId: string): Promise<RoadmapTestResultRow[]> {
  const [rows] = await db.execute<(RoadmapTestResultRow & RowDataPacket)[]>(
    'SELECT `id`, `userId`, `testId`, `roadmapId`, `itemId`, `attemptNumber`, `score`, `maxScore`, `percent`, `correctCount`, `totalQuestions`, `passed`, `createdAt` ' +
      'FROM `RoadmapTestResult` WHERE `userId` = :userId AND `itemId` = :itemId ORDER BY `createdAt` DESC',
    { userId, itemId },
  );
  return rows;
}

export async function countAttempts(userId: string, itemId: string): Promise<number> {
  const [rows] = await db.execute<(RowDataPacket & { n: number })[]>(
    'SELECT COUNT(*) AS n FROM `RoadmapTestResult` WHERE `userId` = :userId AND `itemId` = :itemId',
    { userId, itemId },
  );
  return Number(rows[0]?.n ?? 0);
}
