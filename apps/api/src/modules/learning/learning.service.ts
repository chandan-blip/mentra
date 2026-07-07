import type {
  LearningCategoryView,
  LearningDifficulty,
  LearningProgressView,
  LearningTestGradedQuestion,
  LearningTestResultView,
  LearningTestSubmitResult,
  LearningTestSummary,
  LearningTestView,
  SubmitLearningTestInput,
} from '@mentra/shared';
import { logger } from '../../logger.js';
import { emit } from '../../core/events.js';
import { getActiveRoadmap } from '../roadmap/index.js';
import { getProfile } from '../user-profile/index.js';
import { generateCategories } from './category.ai.js';
import { generateTestQuestions } from './test.ai.js';
import { LearningError } from './learning.errors.js';
import {
  countAttempts,
  countCategoriesByUser,
  createCategoriesWithTests,
  findCategoryById,
  findTestById,
  insertResult,
  listCategoriesByUser,
  listQuestions,
  listResultsByUser,
  listTestsByCategory,
  listTestsByUser,
  saveGeneratedQuestions,
  type LearningCategoryRow,
  type LearningTestQuestionRow,
  type LearningTestResultRow,
  type LearningTestRow,
} from './learning.repository.js';

// --- Config ---

const PASS_PERCENT = 70;
const QUESTIONS_PER_TEST = 10;

/** The fixed difficulty ladder every category gets, in order. */
const LADDER: { difficulty: LearningDifficulty; title: string }[] = [
  { difficulty: 'beginner', title: 'Beginner' },
  { difficulty: 'intermediate', title: 'Intermediate' },
  { difficulty: 'advanced', title: 'Advanced' },
];

// --- Category generation (on first access) ---

/** Generate + persist the student's categories the first time they open Learning. */
async function ensureCategories(userId: string): Promise<void> {
  if ((await countCategoriesByUser(userId)) > 0) return;

  const [profile, roadmap] = await Promise.all([getProfile(userId), getActiveRoadmap(userId)]);
  const topicTitles = (roadmap?.weeks ?? [])
    .flatMap((w) => w.items)
    .filter((i) => i.type === 'topic')
    .map((i) => i.title);

  logger.info({ userId, topics: topicTitles.length }, 'learning.categories.generate');
  const { model, categories } = await generateCategories({
    goal: profile.goal,
    targetRoles: profile.targetRoles,
    techStack: profile.techStack,
    topicTitles,
  });

  await createCategoriesWithTests({
    userId,
    generatedBy: model,
    categories: categories.map((c, i) => ({
      slug: c.slug,
      title: c.title,
      description: c.description,
      skillTags: c.skillTags,
      icon: null,
      order: i,
      tests: LADDER.map((l, j) => ({
        difficulty: l.difficulty,
        order: j,
        title: l.title,
        passPercent: PASS_PERCENT,
      })),
    })),
  });
}

// --- Views ---

function toTestSummary(test: LearningTestRow, results: LearningTestResultRow[]): LearningTestSummary {
  const mine = results.filter((r) => r.testId === test.id);
  const bestPercent = mine.length ? Math.max(...mine.map((r) => r.percent)) : null;
  return {
    id: test.id,
    categoryId: test.categoryId,
    difficulty: test.difficulty,
    order: test.order,
    title: test.title,
    totalQuestions: test.totalQuestions,
    passPercent: test.passPercent,
    generated: Boolean(test.generatedAt),
    attempts: mine.length,
    bestPercent,
    passed: mine.some((r) => Boolean(r.passed)),
  };
}

function toCategoryView(
  category: LearningCategoryRow,
  tests: LearningTestRow[],
  results: LearningTestResultRow[],
): LearningCategoryView {
  const summaries = tests
    .filter((t) => t.categoryId === category.id)
    .sort((a, b) => a.order - b.order)
    .map((t) => toTestSummary(t, results));
  return {
    id: category.id,
    slug: category.slug,
    title: category.title,
    description: category.description,
    skillTags: category.skillTags,
    icon: category.icon,
    order: category.order,
    tests: summaries,
    seriesCompleted: summaries.length > 0 && summaries.every((s) => s.passed),
  };
}

function toTestView(test: LearningTestRow, questions: LearningTestQuestionRow[]): LearningTestView {
  return {
    id: test.id,
    categoryId: test.categoryId,
    difficulty: test.difficulty,
    title: test.title,
    totalQuestions: test.totalQuestions,
    maxScore: test.maxScore,
    passPercent: test.passPercent,
    // Never leak `correct` to the client.
    questions: questions.map((q) => ({
      id: q.id,
      order: q.order,
      type: q.type,
      body: q.body,
      options: q.options,
      points: q.points,
    })),
  };
}

// --- Public API ---

export async function listCategories(userId: string): Promise<LearningCategoryView[]> {
  await ensureCategories(userId);
  const [categories, tests, results] = await Promise.all([
    listCategoriesByUser(userId),
    listTestsByUser(userId),
    listResultsByUser(userId),
  ]);
  return categories.map((c) => toCategoryView(c, tests, results));
}

export async function getCategory(userId: string, categoryId: string): Promise<LearningCategoryView> {
  const category = await findCategoryById(categoryId);
  if (!category || category.userId !== userId) {
    throw new LearningError('CATEGORY_NOT_FOUND', 'Category not found', 404);
  }
  const [tests, results] = await Promise.all([
    listTestsByCategory(categoryId),
    listResultsByUser(userId),
  ]);
  return toCategoryView(category, tests, results);
}

/** Start a test — generates + caches the MCQs on first start, then returns the test. */
export async function startTest(userId: string, testId: string): Promise<LearningTestView> {
  const test = await requireOwnedTest(userId, testId);
  if (!test.generatedAt) {
    const category = await findCategoryById(test.categoryId);
    if (!category) throw new LearningError('CATEGORY_NOT_FOUND', 'Category not found', 404);

    logger.info({ userId, testId, difficulty: test.difficulty }, 'learning.test.generate');
    const { model, questions } = await generateTestQuestions({
      categoryTitle: category.title,
      categoryDescription: category.description,
      skillTags: category.skillTags,
      difficulty: test.difficulty,
      count: QUESTIONS_PER_TEST,
    });
    await saveGeneratedQuestions({
      testId,
      model,
      questions: questions.map((q) => ({
        type: q.type,
        body: q.body,
        options: q.options,
        // Keep only correct indices that point at a real option.
        correct: [...new Set(q.correct.filter((i) => i >= 0 && i < q.options.length))],
        explanation: q.explanation ?? null,
        points: q.points,
      })),
    });
  }

  const refreshed = (await findTestById(testId)) ?? test;
  const questions = await listQuestions(testId);
  return toTestView(refreshed, questions);
}

/** Fetch an already-generated test (to resume), scoped to the caller. */
export async function getTest(userId: string, testId: string): Promise<LearningTestView> {
  const test = await requireOwnedTest(userId, testId);
  const questions = await listQuestions(testId);
  return toTestView(test, questions);
}

export async function submitTest(
  userId: string,
  testId: string,
  body: SubmitLearningTestInput,
): Promise<LearningTestSubmitResult> {
  const test = await requireOwnedTest(userId, testId);
  const questions = await listQuestions(testId);
  if (questions.length === 0) {
    throw new LearningError('TEST_EMPTY', 'Start the test before submitting it', 409);
  }

  const outcome = gradeTest(questions, body.answers, test.passPercent);
  const attemptNumber = (await countAttempts(userId, testId)) + 1;
  const resultId = await insertResult({
    userId,
    testId,
    categoryId: test.categoryId,
    attemptNumber,
    score: outcome.score,
    maxScore: outcome.maxScore,
    percent: outcome.percent,
    correctCount: outcome.correctCount,
    totalQuestions: outcome.totalQuestions,
    passed: outcome.passed,
  });

  logger.info(
    { userId, testId, categoryId: test.categoryId, percent: outcome.percent, passed: outcome.passed },
    'learning.test.submitted',
  );
  emit('learning.test.completed', {
    userId,
    categoryId: test.categoryId,
    testId,
    percent: outcome.percent,
    passed: outcome.passed,
  });

  const seriesCompleted = await didCompleteSeries(userId, test, resultId, outcome.passed);
  if (seriesCompleted) {
    emit('learning.series.completed', { userId, categoryId: test.categoryId });
    logger.info({ userId, categoryId: test.categoryId }, 'learning.series.completed');
  }

  const result: LearningTestResultView = {
    id: resultId,
    testId,
    categoryId: test.categoryId,
    attemptNumber,
    score: outcome.score,
    maxScore: outcome.maxScore,
    percent: outcome.percent,
    correctCount: outcome.correctCount,
    totalQuestions: outcome.totalQuestions,
    passed: outcome.passed,
    createdAt: new Date().toISOString(),
  };

  const graded: LearningTestGradedQuestion[] = outcome.graded.map((g) => {
    const q = questions.find((x) => x.id === g.questionId);
    return { ...g, explanation: q?.explanation ?? null };
  });

  return { result, graded, seriesCompleted };
}

export async function getProgress(userId: string): Promise<LearningProgressView> {
  const [categories, tests, results] = await Promise.all([
    listCategoriesByUser(userId),
    listTestsByUser(userId),
    listResultsByUser(userId),
  ]);
  const views = categories.map((c) => toCategoryView(c, tests, results));
  const testsPassed = views.reduce((n, c) => n + c.tests.filter((t) => t.passed).length, 0);
  const seriesCompleted = views.filter((c) => c.seriesCompleted).length;
  const bests = views.flatMap((c) => c.tests.map((t) => t.bestPercent).filter((p): p is number => p !== null));
  const averageBestPercent = bests.length ? Math.round(bests.reduce((a, b) => a + b, 0) / bests.length) : 0;
  return {
    categoriesCount: categories.length,
    testsPassed,
    seriesCompleted,
    averageBestPercent,
  };
}

// --- Helpers ---

async function requireOwnedTest(userId: string, testId: string): Promise<LearningTestRow> {
  const test = await findTestById(testId);
  if (!test || test.userId !== userId) {
    throw new LearningError('TEST_NOT_FOUND', 'Test not found', 404);
  }
  return test;
}

/**
 * True only when this attempt is the one that first completes the whole ladder:
 * every test in the category now has a passing result, and this test had no prior pass.
 * Keeps `learning.series.completed` firing exactly once.
 */
async function didCompleteSeries(
  userId: string,
  test: LearningTestRow,
  newResultId: string,
  passedNow: boolean,
): Promise<boolean> {
  if (!passedNow) return false;
  const [tests, results] = await Promise.all([
    listTestsByCategory(test.categoryId),
    listResultsByUser(userId),
  ]);
  const priorPassForThisTest = results.some(
    (r) => r.testId === test.id && Boolean(r.passed) && r.id !== newResultId,
  );
  if (priorPassForThisTest) return false; // series was already (or previously) completable via this test
  const passedTestIds = new Set(results.filter((r) => Boolean(r.passed)).map((r) => r.testId));
  return tests.length > 0 && tests.every((t) => passedTestIds.has(t.id));
}

// --- Grading (mirrors roadmap grade.ts) ---

type GradeOutcome = {
  graded: { questionId: string; correct: number[]; selected: number[]; isCorrect: boolean; pointsAwarded: number; points: number }[];
  score: number;
  maxScore: number;
  percent: number;
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
};

/** Two index sets are equal iff they contain exactly the same indices (order-free). */
function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const x of b) if (!sa.has(x)) return false;
  return true;
}

function gradeTest(
  questions: LearningTestQuestionRow[],
  answers: SubmitLearningTestInput['answers'],
  passPercent: number,
): GradeOutcome {
  const byQuestion = new Map(answers.map((a) => [a.questionId, a.selected]));
  const graded = questions.map((q) => {
    const selectedRaw = byQuestion.get(q.id) ?? [];
    const selected = [...new Set(selectedRaw.filter((i) => i >= 0 && i < q.options.length))];
    const isCorrect = selected.length > 0 && sameSet(selected, q.correct);
    return {
      questionId: q.id,
      correct: q.correct,
      selected,
      isCorrect,
      pointsAwarded: isCorrect ? q.points : 0,
      points: q.points,
    };
  });
  const score = graded.reduce((n, g) => n + g.pointsAwarded, 0);
  const maxScore = questions.reduce((n, q) => n + q.points, 0);
  const correctCount = graded.filter((g) => g.isCorrect).length;
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return { graded, score, maxScore, percent, correctCount, totalQuestions: questions.length, passed: percent >= passPercent };
}
