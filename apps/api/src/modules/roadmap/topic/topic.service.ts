import type {
  RoadmapSubtopicView,
  RoadmapTestResultView,
  RoadmapTestSubmitResult,
  RoadmapTestView,
  RoadmapTopicView,
  SubmitRoadmapTestInput,
} from '@mentra/shared';
import { env } from '../../../env.js';
import { logger } from '../../../logger.js';
import { emit } from '../../../core/events.js';
import { RoadmapError } from '../roadmap.errors.js';
import {
  findItemWithContext,
  updateItemStatus,
  type ItemWithContext,
} from '../roadmap.repository.js';
import { resolveUnlocks } from '../transitions/item-transition.service.js';
import { generateSubtopics } from './subtopics.ai.js';
import { generateTestQuestions } from './test.ai.js';
import { gradeTest } from './grade.js';
import {
  countAttempts,
  createTestWithQuestions,
  findOpenTest,
  findTestById,
  insertSubtopics,
  listQuestions,
  listResultsByItem,
  listSubtopicsByItem,
  markTestInProgress,
  recordAttempt,
  type NewQuestion,
  type RoadmapSubtopicRow,
  type RoadmapTestResultRow,
  type RoadmapTestRow,
} from './topic.repository.js';

// --- Guards ---

/** Load a roadmap item, asserting it belongs to the caller, is on the active
 *  roadmap, and is a `topic` (only topics carry subtopics + a completion test). */
async function requireTopic(userId: string, itemId: string): Promise<ItemWithContext> {
  const item = await findItemWithContext(itemId);
  if (!item || item.userId !== userId) {
    throw new RoadmapError('ITEM_NOT_FOUND', 'Roadmap item not found', 404);
  }
  if (item.roadmapStatus !== 'active') {
    throw new RoadmapError('ROADMAP_NOT_ACTIVE', 'Cannot work on an archived roadmap', 409);
  }
  if (item.type !== 'topic') {
    throw new RoadmapError('NOT_A_TOPIC', 'Only topic items have subtopics and a test', 409);
  }
  return item;
}

// --- Views ---

function toSubtopicView(row: RoadmapSubtopicRow): RoadmapSubtopicView {
  return {
    id: row.id,
    itemId: row.itemId,
    order: row.order,
    title: row.title,
    description: row.description,
    estimatedMin: row.estimatedMin,
  };
}

function toResultView(row: RoadmapTestResultRow): RoadmapTestResultView {
  return {
    id: row.id,
    testId: row.testId,
    itemId: row.itemId,
    roadmapId: row.roadmapId,
    attemptNumber: row.attemptNumber,
    score: row.score,
    maxScore: row.maxScore,
    percent: row.percent,
    correctCount: row.correctCount,
    totalQuestions: row.totalQuestions,
    passed: Boolean(row.passed),
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

function toTestView(test: RoadmapTestRow, questions: Awaited<ReturnType<typeof listQuestions>>): RoadmapTestView {
  return {
    id: test.id,
    itemId: test.itemId,
    roadmapId: test.roadmapId,
    status: test.status,
    totalQuestions: test.totalQuestions,
    maxScore: test.maxScore,
    passPercent: test.passPercent,
    // Never leak `correct` to the client.
    questions: questions.map((q) => ({
      id: q.id,
      subtopicId: q.subtopicId,
      order: q.order,
      type: q.type,
      body: q.body,
      options: q.options,
      points: q.points,
    })),
  };
}

// --- Subtopics (on-demand generation) ---

/** Return the topic's subtopics, generating them via the AI on first access. */
export async function getSubtopics(userId: string, itemId: string): Promise<RoadmapSubtopicView[]> {
  const item = await requireTopic(userId, itemId);
  const rows = await ensureSubtopics(item);
  return rows.map(toSubtopicView);
}

async function ensureSubtopics(item: ItemWithContext): Promise<RoadmapSubtopicRow[]> {
  const existing = await listSubtopicsByItem(item.id);
  if (existing.length > 0) return existing;

  logger.info({ itemId: item.id }, 'roadmap.subtopics.generate');
  const { model, subtopics } = await generateSubtopics({
    title: item.title,
    description: item.description,
    skillIds: item.skillIds ?? [],
  });
  await insertSubtopics({ roadmapId: item.roadmapId, itemId: item.id, generatedBy: model, subtopics });
  return listSubtopicsByItem(item.id);
}

// --- Test (on-demand generation) ---

/** Start (or resume) the topic's test. Questions are AI-generated on first start. */
export async function startTest(userId: string, itemId: string): Promise<RoadmapTestView> {
  const item = await requireTopic(userId, itemId);
  if (item.status === 'locked') {
    throw new RoadmapError('ITEM_LOCKED', 'Complete the prerequisites before taking this test', 409);
  }

  const open = await findOpenTest(userId, itemId);
  if (open) {
    await markTestInProgress(open.id);
    const questions = await listQuestions(open.id);
    const refreshed = (await findTestById(open.id)) ?? open;
    return toTestView(refreshed, questions);
  }

  // No open test → build one. Subtopics must exist first so the test covers them all.
  const subtopics = await ensureSubtopics(item);
  logger.info({ itemId, subtopics: subtopics.length }, 'roadmap.test.generate');
  const { model, questions: gen } = await generateTestQuestions({
    topicTitle: item.title,
    subtopics: subtopics.map((s) => ({ title: s.title, description: s.description })),
  });

  // Map each generated question back to a subtopic row by title (best-effort).
  const byTitle = new Map(subtopics.map((s) => [s.title.trim().toLowerCase(), s.id]));
  const newQuestions: NewQuestion[] = gen.map((q) => ({
    subtopicId: q.subtopicTitle ? byTitle.get(q.subtopicTitle.trim().toLowerCase()) ?? null : null,
    type: q.type,
    body: q.body,
    options: q.options,
    // Keep only correct indices that point at a real option.
    correct: [...new Set(q.correct.filter((i) => i >= 0 && i < q.options.length))],
    explanation: q.explanation ?? null,
    points: q.points,
  }));

  const testId = await createTestWithQuestions({
    userId,
    roadmapId: item.roadmapId,
    itemId,
    model,
    passPercent: env.ROADMAP_TEST_PASS_PERCENT,
    questions: newQuestions,
  });
  await markTestInProgress(testId);

  const test = await findTestById(testId);
  const questions = await listQuestions(testId);
  if (!test) throw new RoadmapError('TEST_MISSING', 'Test not found after creation', 500);
  return toTestView(test, questions);
}

/** Fetch an in-flight test (to resume), scoped to the caller. */
export async function getTest(userId: string, testId: string): Promise<RoadmapTestView> {
  const test = await findTestById(testId);
  if (!test || test.userId !== userId) {
    throw new RoadmapError('TEST_NOT_FOUND', 'Test not found', 404);
  }
  const questions = await listQuestions(testId);
  return toTestView(test, questions);
}

// --- Submission + grading ---

export async function submitTest(
  userId: string,
  testId: string,
  body: SubmitRoadmapTestInput,
): Promise<RoadmapTestSubmitResult> {
  const test = await findTestById(testId);
  if (!test || test.userId !== userId) {
    throw new RoadmapError('TEST_NOT_FOUND', 'Test not found', 404);
  }
  if (test.status === 'completed') {
    throw new RoadmapError('TEST_ALREADY_SUBMITTED', 'This test was already submitted', 409);
  }

  const questions = await listQuestions(testId);
  if (questions.length === 0) {
    throw new RoadmapError('TEST_EMPTY', 'Test has no questions', 409);
  }

  const outcome = gradeTest(questions, body.answers, test.passPercent);
  const priorAttempts = await countAttempts(userId, test.itemId);

  const resultId = await recordAttempt({
    test,
    answers: outcome.graded.map((g) => ({
      questionId: g.questionId,
      selected: g.selected,
      isCorrect: g.isCorrect,
      pointsAwarded: g.pointsAwarded,
    })),
    attemptNumber: priorAttempts + 1,
    score: outcome.score,
    maxScore: outcome.maxScore,
    percent: outcome.percent,
    correctCount: outcome.correctCount,
    totalQuestions: outcome.totalQuestions,
    passed: outcome.passed,
  });

  logger.info(
    { userId, testId, itemId: test.itemId, percent: outcome.percent, passed: outcome.passed },
    'roadmap.test.submitted',
  );

  // Passing the test is what marks the topic complete (and unlocks dependents).
  // Failing records the marks but leaves the topic open for a retake.
  let itemStatus = (await findItemWithContext(test.itemId))?.status ?? 'in_progress';
  let unlocked: string[] = [];
  if (outcome.passed && itemStatus !== 'completed') {
    await updateItemStatus(test.itemId, 'completed', new Date());
    unlocked = await resolveUnlocks(test.roadmapId);
    itemStatus = 'completed';
    emit('roadmap.item.completed', { userId, roadmapId: test.roadmapId, itemId: test.itemId });
    logger.info({ userId, itemId: test.itemId }, 'roadmap.item.completed_via_test');
  }

  const result: RoadmapTestResultView = {
    id: resultId,
    testId: test.id,
    itemId: test.itemId,
    roadmapId: test.roadmapId,
    attemptNumber: priorAttempts + 1,
    score: outcome.score,
    maxScore: outcome.maxScore,
    percent: outcome.percent,
    correctCount: outcome.correctCount,
    totalQuestions: outcome.totalQuestions,
    passed: outcome.passed,
    createdAt: new Date().toISOString(),
  };

  return {
    result,
    graded: outcome.graded.map((g) => {
      const q = questions.find((x) => x.id === g.questionId);
      return {
        questionId: g.questionId,
        correct: g.correct,
        selected: g.selected,
        isCorrect: g.isCorrect,
        pointsAwarded: g.pointsAwarded,
        points: g.points,
        explanation: q?.explanation ?? null,
      };
    }),
    itemStatus,
    unlocked,
  };
}

// --- Topic drilldown + marks history ---

export async function getResults(userId: string, itemId: string): Promise<RoadmapTestResultView[]> {
  await requireTopic(userId, itemId);
  const rows = await listResultsByItem(userId, itemId);
  return rows.map(toResultView);
}

export async function getTopicView(userId: string, itemId: string): Promise<RoadmapTopicView> {
  const item = await requireTopic(userId, itemId);
  const [subtopicRows, resultRows, open] = await Promise.all([
    ensureSubtopics(item),
    listResultsByItem(userId, itemId),
    findOpenTest(userId, itemId),
  ]);

  const results = resultRows.map(toResultView);
  const bestResult = results.reduce<RoadmapTestResultView | null>(
    (best, r) => (best === null || r.percent > best.percent ? r : best),
    null,
  );
  // listResultsByItem is ordered newest-first, so the first row is the last attempt.
  const lastResult = results[0] ?? null;

  return {
    itemId,
    subtopics: subtopicRows.map(toSubtopicView),
    bestResult,
    lastResult,
    attempts: results.length,
    openTestId: open?.id ?? null,
    passPercent: env.ROADMAP_TEST_PASS_PERCENT,
  };
}
