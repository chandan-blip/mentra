import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { LearningDifficulty, LearningTestQuestionType } from '@mentra/shared';
import { db } from '../../db.js';
import { createId } from '../../core/id.js';

// --- Row types ---

export type LearningCategoryRow = {
  id: string;
  userId: string;
  slug: string;
  title: string;
  description: string;
  skillTags: string[];
  icon: string | null;
  order: number;
  isShared: boolean;
  experienceLevel: number | null;
  benefit: string | null;
  projects: string[];
  generatedBy: string;
  createdAt: Date;
};

/**
 * Sentinel userId that owns shared "build your own" custom-quiz topics. Never collides with
 * a real user id (those are 32-char hex from createId). Shared categories/tests are visible
 * to every student; only results stay per-user.
 */
export const SHARED_OWNER = 'shared';

export type LearningTestRow = {
  id: string;
  userId: string;
  categoryId: string;
  difficulty: LearningDifficulty;
  order: number;
  title: string;
  model: string | null;
  totalQuestions: number;
  maxScore: number;
  passPercent: number;
  generatedAt: Date | null;
  createdAt: Date;
};

export type LearningTestQuestionRow = {
  id: string;
  testId: string;
  order: number;
  type: LearningTestQuestionType;
  body: string;
  options: string[];
  correct: number[];
  explanation: string | null;
  points: number;
};

export type LearningTestResultRow = {
  id: string;
  userId: string;
  testId: string;
  categoryId: string;
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

// --- Categories ---

const CATEGORY_COLS =
  '`id`, `userId`, `slug`, `title`, `description`, `skillTags`, `icon`, `order`, `isShared`, `experienceLevel`, `benefit`, `projects`, `generatedBy`, `createdAt`';

function toCategoryRow(row: LearningCategoryRow & RowDataPacket): LearningCategoryRow {
  return {
    ...row,
    skillTags: asArray<string>(row.skillTags),
    isShared: Boolean(row.isShared),
    projects: asArray<string>(row.projects),
  };
}

/** Count only the student's OWN ladder categories — shared topics must not suppress first-visit generation. */
export async function countCategoriesByUser(userId: string): Promise<number> {
  const [rows] = await db.execute<(RowDataPacket & { n: number })[]>(
    'SELECT COUNT(*) AS n FROM `LearningCategory` WHERE `userId` = :userId AND `isShared` = 0',
    { userId },
  );
  return Number(rows[0]?.n ?? 0);
}

/** The student's own categories unioned with every shared custom-quiz topic (the landing list). */
export async function listCategoriesByUser(userId: string): Promise<LearningCategoryRow[]> {
  const [rows] = await db.execute<(LearningCategoryRow & RowDataPacket)[]>(
    `SELECT ${CATEGORY_COLS} FROM \`LearningCategory\` ` +
      'WHERE `userId` = :userId OR `isShared` = 1 ORDER BY `isShared`, `order`, `createdAt`',
    { userId },
  );
  return rows.map(toCategoryRow);
}

/** All shared custom-quiz topics (no user) — the public/anonymous learning catalogue. */
export async function listSharedCategories(): Promise<LearningCategoryRow[]> {
  const [rows] = await db.execute<(LearningCategoryRow & RowDataPacket)[]>(
    `SELECT ${CATEGORY_COLS} FROM \`LearningCategory\` WHERE \`isShared\` = 1 ORDER BY \`order\`, \`createdAt\``,
  );
  return rows.map(toCategoryRow);
}

/** Tests belonging to shared topics — paired with listSharedCategories for public views. */
export async function listSharedTests(): Promise<LearningTestRow[]> {
  const [rows] = await db.execute<(LearningTestRow & RowDataPacket)[]>(
    `SELECT ${TEST_COLS} FROM \`LearningTest\` WHERE \`userId\` = :owner ORDER BY \`order\``,
    { owner: SHARED_OWNER },
  );
  return rows;
}

/** Only the student's OWN ladder categories — for personal progress stats (excludes shared topics). */
export async function listOwnCategories(userId: string): Promise<LearningCategoryRow[]> {
  const [rows] = await db.execute<(LearningCategoryRow & RowDataPacket)[]>(
    `SELECT ${CATEGORY_COLS} FROM \`LearningCategory\` WHERE \`userId\` = :userId ORDER BY \`order\`, \`createdAt\``,
    { userId },
  );
  return rows.map(toCategoryRow);
}

export async function findCategoryById(id: string): Promise<LearningCategoryRow | null> {
  const [rows] = await db.execute<(LearningCategoryRow & RowDataPacket)[]>(
    `SELECT ${CATEGORY_COLS} FROM \`LearningCategory\` WHERE \`id\` = :id LIMIT 1`,
    { id },
  );
  const row = rows[0];
  return row ? toCategoryRow(row) : null;
}

/** Look up a shared custom-quiz topic by its cache key (stored as the shared row's slug). */
export async function findSharedCategoryBySlug(slug: string): Promise<LearningCategoryRow | null> {
  const [rows] = await db.execute<(LearningCategoryRow & RowDataPacket)[]>(
    `SELECT ${CATEGORY_COLS} FROM \`LearningCategory\` WHERE \`userId\` = :owner AND \`slug\` = :slug LIMIT 1`,
    { owner: SHARED_OWNER, slug },
  );
  const row = rows[0];
  return row ? toCategoryRow(row) : null;
}

/** Free-text topic search across the student's own categories + all shared topics (title/description/tags). */
export async function searchCategories(userId: string, q: string): Promise<LearningCategoryRow[]> {
  const like = `%${q}%`;
  const [rows] = await db.execute<(LearningCategoryRow & RowDataPacket)[]>(
    `SELECT ${CATEGORY_COLS} FROM \`LearningCategory\` ` +
      'WHERE (`userId` = :userId OR `isShared` = 1) ' +
      'AND (`title` LIKE :like OR `description` LIKE :like OR `skillTags` LIKE :like) ' +
      'ORDER BY `isShared`, `order`, `createdAt` LIMIT 30',
    { userId, like },
  );
  return rows.map(toCategoryRow);
}

export type NewCategory = {
  slug: string;
  title: string;
  description: string;
  skillTags: string[];
  icon: string | null;
  order: number;
  benefit: string | null;
  projects: string[];
  tests: { difficulty: LearningDifficulty; order: number; title: string; passPercent: number }[];
};

/**
 * Insert a batch of categories with their (empty) test ladder rows in one transaction.
 * Questions are generated lazily on first start, so tests start with no questions.
 * Idempotent per (userId, slug): a category that already exists is skipped.
 */
export async function createCategoriesWithTests(input: {
  userId: string;
  generatedBy: string;
  categories: NewCategory[];
}): Promise<void> {
  if (input.categories.length === 0) return;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const c of input.categories) {
      const categoryId = createId();
      const [res] = await conn.execute<ResultSetHeader>(
        'INSERT IGNORE INTO `LearningCategory` (`id`, `userId`, `slug`, `title`, `description`, `skillTags`, `icon`, `order`, `benefit`, `projects`, `generatedBy`) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          categoryId,
          input.userId,
          c.slug,
          c.title,
          c.description,
          JSON.stringify(c.skillTags),
          c.icon,
          c.order,
          c.benefit,
          JSON.stringify(c.projects),
          input.generatedBy,
        ],
      );
      // INSERT IGNORE skipped a duplicate slug → don't create its tests again.
      if (res.affectedRows === 0) continue;
      for (const t of c.tests) {
        await conn.execute(
          'INSERT INTO `LearningTest` (`id`, `userId`, `categoryId`, `difficulty`, `order`, `title`, `passPercent`) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?)',
          [createId(), input.userId, categoryId, t.difficulty, t.order, t.title, t.passPercent],
        );
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Insert one shared custom-quiz topic (owned by SHARED_OWNER) + its single test rung, in a
 * transaction. Idempotent on the shared (userId, slug) unique key: if the topic already
 * exists (a concurrent request won the race), returns the existing ids and inserts nothing.
 * Questions are persisted separately via `saveGeneratedQuestions`.
 */
export async function insertSharedCategoryWithTest(input: {
  slug: string;
  title: string;
  description: string;
  skillTags: string[];
  experienceLevel: number;
  benefit: string | null;
  projects: string[];
  difficulty: LearningDifficulty;
  testTitle: string;
  passPercent: number;
  generatedBy: string;
}): Promise<{ categoryId: string; testId: string; created: boolean }> {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const categoryId = createId();
    const [res] = await conn.execute<ResultSetHeader>(
      'INSERT IGNORE INTO `LearningCategory` ' +
        '(`id`, `userId`, `slug`, `title`, `description`, `skillTags`, `icon`, `order`, `isShared`, `experienceLevel`, `benefit`, `projects`, `generatedBy`) ' +
        'VALUES (?, ?, ?, ?, ?, ?, NULL, 0, 1, ?, ?, ?, ?)',
      [
        categoryId,
        SHARED_OWNER,
        input.slug,
        input.title,
        input.description,
        JSON.stringify(input.skillTags),
        input.experienceLevel,
        input.benefit,
        JSON.stringify(input.projects),
        input.generatedBy,
      ],
    );
    if (res.affectedRows === 0) {
      // Lost the race — the topic now exists. Return the winner's ids.
      await conn.commit();
      const [catRows] = await db.execute<(LearningCategoryRow & RowDataPacket)[]>(
        'SELECT `id` FROM `LearningCategory` WHERE `userId` = :owner AND `slug` = :slug LIMIT 1',
        { owner: SHARED_OWNER, slug: input.slug },
      );
      const existingCategoryId = catRows[0]?.id ?? categoryId;
      const [testRows] = await db.execute<(LearningTestRow & RowDataPacket)[]>(
        'SELECT `id` FROM `LearningTest` WHERE `categoryId` = :categoryId ORDER BY `order` LIMIT 1',
        { categoryId: existingCategoryId },
      );
      return { categoryId: existingCategoryId, testId: testRows[0]?.id ?? '', created: false };
    }
    const testId = createId();
    await conn.execute(
      'INSERT INTO `LearningTest` (`id`, `userId`, `categoryId`, `difficulty`, `order`, `title`, `passPercent`) ' +
        'VALUES (?, ?, ?, ?, 0, ?, ?)',
      [testId, SHARED_OWNER, categoryId, input.difficulty, input.testTitle, input.passPercent],
    );
    await conn.commit();
    return { categoryId, testId, created: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// --- Tests ---

const TEST_COLS =
  '`id`, `userId`, `categoryId`, `difficulty`, `order`, `title`, `model`, `totalQuestions`, `maxScore`, `passPercent`, `generatedAt`, `createdAt`';

/** The student's own tests plus all shared custom-quiz tests (their categories show in the list). */
export async function listTestsByUser(userId: string): Promise<LearningTestRow[]> {
  const [rows] = await db.execute<(LearningTestRow & RowDataPacket)[]>(
    `SELECT ${TEST_COLS} FROM \`LearningTest\` WHERE \`userId\` = :userId OR \`userId\` = :owner ORDER BY \`order\``,
    { userId, owner: SHARED_OWNER },
  );
  return rows;
}

export async function listTestsByCategory(categoryId: string): Promise<LearningTestRow[]> {
  const [rows] = await db.execute<(LearningTestRow & RowDataPacket)[]>(
    `SELECT ${TEST_COLS} FROM \`LearningTest\` WHERE \`categoryId\` = :categoryId ORDER BY \`order\``,
    { categoryId },
  );
  return rows;
}

export async function findTestById(testId: string): Promise<LearningTestRow | null> {
  const [rows] = await db.execute<(LearningTestRow & RowDataPacket)[]>(
    `SELECT ${TEST_COLS} FROM \`LearningTest\` WHERE \`id\` = :id LIMIT 1`,
    { id: testId },
  );
  return rows[0] ?? null;
}

export type NewQuestion = {
  type: LearningTestQuestionType;
  body: string;
  options: string[];
  correct: number[];
  explanation: string | null;
  points: number;
};

/** Persist generated questions + stamp the test as generated (metadata) atomically. */
export async function saveGeneratedQuestions(input: {
  testId: string;
  model: string;
  questions: NewQuestion[];
}): Promise<void> {
  const conn = await db.getConnection();
  const maxScore = input.questions.reduce((n, q) => n + q.points, 0);
  try {
    await conn.beginTransaction();
    // Replace any prior questions (defensive — only reached on regeneration).
    await conn.execute('DELETE FROM `LearningTestQuestion` WHERE `testId` = ?', [input.testId]);
    let order = 0;
    for (const q of input.questions) {
      await conn.execute(
        'INSERT INTO `LearningTestQuestion` (`id`, `testId`, `order`, `type`, `body`, `options`, `correct`, `explanation`, `points`) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          createId(),
          input.testId,
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
    await conn.execute(
      'UPDATE `LearningTest` SET `model` = ?, `totalQuestions` = ?, `maxScore` = ?, `generatedAt` = NOW(3) WHERE `id` = ?',
      [input.model, input.questions.length, maxScore, input.testId],
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listQuestions(testId: string): Promise<LearningTestQuestionRow[]> {
  const [rows] = await db.execute<(LearningTestQuestionRow & RowDataPacket)[]>(
    'SELECT `id`, `testId`, `order`, `type`, `body`, `options`, `correct`, `explanation`, `points` ' +
      'FROM `LearningTestQuestion` WHERE `testId` = :testId ORDER BY `order`',
    { testId },
  );
  return rows.map((r) => ({
    ...r,
    options: asArray<string>(r.options),
    correct: asArray<number>(r.correct),
  }));
}

// --- Results ---

const RESULT_COLS =
  '`id`, `userId`, `testId`, `categoryId`, `attemptNumber`, `score`, `maxScore`, `percent`, `correctCount`, `totalQuestions`, `passed`, `createdAt`';

export async function insertResult(input: {
  userId: string;
  testId: string;
  categoryId: string;
  attemptNumber: number;
  score: number;
  maxScore: number;
  percent: number;
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
}): Promise<string> {
  const id = createId();
  await db.execute<ResultSetHeader>(
    'INSERT INTO `LearningTestResult` (`id`, `userId`, `testId`, `categoryId`, `attemptNumber`, `score`, `maxScore`, `percent`, `correctCount`, `totalQuestions`, `passed`) ' +
      'VALUES (:id, :userId, :testId, :categoryId, :attemptNumber, :score, :maxScore, :percent, :correctCount, :totalQuestions, :passed)',
    { id, ...input },
  );
  return id;
}

export async function countAttempts(userId: string, testId: string): Promise<number> {
  const [rows] = await db.execute<(RowDataPacket & { n: number })[]>(
    'SELECT COUNT(*) AS n FROM `LearningTestResult` WHERE `userId` = :userId AND `testId` = :testId',
    { userId, testId },
  );
  return Number(rows[0]?.n ?? 0);
}

export async function listResultsByUser(userId: string): Promise<LearningTestResultRow[]> {
  const [rows] = await db.execute<(LearningTestResultRow & RowDataPacket)[]>(
    `SELECT ${RESULT_COLS} FROM \`LearningTestResult\` WHERE \`userId\` = :userId ORDER BY \`createdAt\` DESC`,
    { userId },
  );
  return rows;
}
