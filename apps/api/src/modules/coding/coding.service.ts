import type {
  CodingProgressView,
  CodingQuestionAdminView,
  CodingQuestionDetail,
  CodingStatus,
  CodingSubmissionAdminView,
  CodingSubmissionView,
  CodingTaskAdminView,
  CodingTaskDetail,
  CodingTaskListItem,
  CreateCodingTaskInput,
  SubmitCodingInput,
  UpdateCodingTaskInput,
} from '@mentra/shared';
import { emit } from '../../core/events.js';
import { CodingError } from './coding.errors.js';
import { gradeSubmission } from './coding.exec.js';
import { reviewSubmission } from './coding.ai.js';
import * as repo from './coding.repository.js';

// --- View mappers ---

function toSubmissionView(row: repo.CodingSubmissionRow): CodingSubmissionView {
  return {
    id: row.id,
    taskId: row.taskId,
    questionId: row.questionId,
    language: row.language,
    code: row.code,
    status: row.status,
    passedCount: row.passedCount,
    totalCount: row.totalCount,
    percent: row.percent,
    results: row.results,
    aiFeedback: row.aiFeedback,
    createdAt: row.createdAt.toISOString(),
  };
}

function toQuestionAdminView(q: repo.CodingQuestionRow): CodingQuestionAdminView {
  return {
    id: q.id,
    title: q.title,
    description: q.description,
    languages: q.languages,
    starterCode: q.starterCode,
    testCases: q.testCases,
  };
}

// --- Student ---

/** The student's task list: each task with question count + how many they've solved. */
export async function listTasks(userId: string): Promise<CodingTaskListItem[]> {
  const [tasks, qCounts, stats] = await Promise.all([
    repo.listVisibleTasks(),
    repo.questionCountByTask(),
    repo.statsForStudentByTask(userId),
  ]);
  return tasks.map((t) => {
    const questionCount = qCounts.get(t.id) ?? 0;
    const s = stats.get(t.id);
    const solvedCount = Math.min(s?.solved ?? 0, questionCount);
    const attempted = s?.attempted ?? 0;
    const status: CodingStatus =
      questionCount > 0 && solvedCount >= questionCount ? 'passed' : attempted > 0 ? 'attempted' : 'not_started';
    return {
      id: t.id,
      title: t.title,
      difficulty: t.difficulty,
      questionCount,
      solvedCount,
      status,
      percent: questionCount > 0 ? Math.round((solvedCount / questionCount) * 100) : 0,
    };
  });
}

/** A task with all its questions, each carrying the student's status + last submission. */
export async function getTask(userId: string, taskId: string): Promise<CodingTaskDetail> {
  const task = await repo.findTaskById(taskId);
  if (!task || !task.visible) throw new CodingError('TASK_NOT_FOUND', 'Coding task not found', 404);
  const [questions, subs] = await Promise.all([
    repo.listQuestionsByTask(taskId),
    repo.listSubmissionsForUserTask(userId, taskId),
  ]);

  // subs are newest-first: first seen per question = latest; track which questions ever passed.
  const latestByQuestion = new Map<string, repo.CodingSubmissionRow>();
  const passedQuestions = new Set<string>();
  for (const s of subs) {
    if (!latestByQuestion.has(s.questionId)) latestByQuestion.set(s.questionId, s);
    if (s.status === 'passed') passedQuestions.add(s.questionId);
  }

  const questionViews: CodingQuestionDetail[] = questions.map((q) => {
    const latest = latestByQuestion.get(q.id) ?? null;
    const status: CodingStatus = passedQuestions.has(q.id) ? 'passed' : latest ? 'attempted' : 'not_started';
    return {
      id: q.id,
      title: q.title,
      description: q.description,
      languages: q.languages,
      starterCode: q.starterCode,
      sampleTestCases: q.testCases
        .filter((tc) => !tc.hidden)
        .map((tc) => ({ input: tc.input, expectedOutput: tc.expectedOutput })),
      status,
      lastSubmission: latest ? toSubmissionView(latest) : null,
    };
  });

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    difficulty: task.difficulty,
    questions: questionViews,
  };
}

/**
 * Grade a submission to ONE question in the sandbox, attach a best-effort AI review, persist
 * it, and return the result. Correct/wrong is decided purely by the sandbox (all cases pass).
 */
export async function submit(
  userId: string,
  taskId: string,
  questionId: string,
  input: SubmitCodingInput,
): Promise<CodingSubmissionView> {
  const [task, question] = await Promise.all([repo.findTaskById(taskId), repo.findQuestionById(questionId)]);
  if (!task || !task.visible) throw new CodingError('TASK_NOT_FOUND', 'Coding task not found', 404);
  if (!question || question.taskId !== taskId) {
    throw new CodingError('QUESTION_NOT_FOUND', 'Question not found', 404);
  }
  if (!question.languages.includes(input.language)) {
    throw new CodingError('LANGUAGE_NOT_ALLOWED', 'That language is not allowed for this question', 400);
  }

  const grade = await gradeSubmission(input.language, input.code, question.testCases);

  const review = await reviewSubmission({
    title: question.title,
    description: question.description,
    language: input.language,
    code: input.code,
    passedCount: grade.passedCount,
    totalCount: grade.totalCount,
  });

  const id = await repo.insertSubmission({
    taskId,
    questionId,
    userId,
    language: input.language,
    code: input.code,
    status: grade.status,
    passedCount: grade.passedCount,
    totalCount: grade.totalCount,
    percent: grade.percent,
    results: grade.results,
    aiFeedback: review?.feedback ?? null,
    aiModel: review?.model ?? null,
  });

  emit('coding.submission.created', { userId, taskId, questionId, status: grade.status, percent: grade.percent });

  const saved = await repo.findSubmissionById(id);
  if (!saved) throw new CodingError('SUBMISSION_FAILED', 'Could not save submission', 500);
  return toSubmissionView(saved);
}

export async function getProgress(userId: string): Promise<CodingProgressView> {
  const [total, tasks, qCounts, stats] = await Promise.all([
    repo.countVisibleQuestions(),
    repo.listVisibleTasks(),
    repo.questionCountByTask(),
    repo.statsForStudentByTask(userId),
  ]);
  let solved = 0;
  let attempted = 0;
  for (const t of tasks) {
    const qc = qCounts.get(t.id) ?? 0;
    const s = stats.get(t.id);
    solved += Math.min(s?.solved ?? 0, qc);
    attempted += Math.min(s?.attempted ?? 0, qc);
  }
  return { totalQuestions: total, attempted, solved, correctPercent: total > 0 ? Math.round((solved / total) * 100) : 0 };
}

// --- Manager ---

export async function listTasksAdmin(): Promise<CodingTaskAdminView[]> {
  const [tasks, allQuestions, qCounts, agg, passedRows] = await Promise.all([
    repo.listAllTasks(),
    repo.listAllQuestions(),
    repo.questionCountByTask(),
    repo.aggregateByTask(),
    repo.passedQuestionsByTaskUser(),
  ]);

  const questionsByTask = new Map<string, repo.CodingQuestionRow[]>();
  for (const q of allQuestions) {
    const list = questionsByTask.get(q.taskId) ?? [];
    list.push(q);
    questionsByTask.set(q.taskId, list);
  }

  // A student "solved" a task when they've passed every question in it.
  const completions = new Map<string, number>();
  for (const r of passedRows) {
    const qc = qCounts.get(r.taskId) ?? 0;
    if (qc > 0 && r.passedQuestions >= qc) completions.set(r.taskId, (completions.get(r.taskId) ?? 0) + 1);
  }

  return tasks.map((t) => {
    const a = agg.get(t.id);
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      difficulty: t.difficulty,
      visible: Boolean(t.visible),
      sortOrder: t.sortOrder,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      questions: (questionsByTask.get(t.id) ?? []).map(toQuestionAdminView),
      stats: {
        submissions: a?.submissions ?? 0,
        students: a?.students ?? 0,
        solved: completions.get(t.id) ?? 0,
      },
    };
  });
}

export async function createTask(userId: string, input: CreateCodingTaskInput): Promise<CodingTaskAdminView> {
  const id = await repo.insertTaskWithQuestions(
    { title: input.title, description: input.description, difficulty: input.difficulty, visible: input.visible, createdBy: userId },
    input.questions,
  );
  return findAdminTask(id);
}

export async function updateTaskById(taskId: string, input: UpdateCodingTaskInput): Promise<CodingTaskAdminView> {
  const existing = await repo.findTaskById(taskId);
  if (!existing) throw new CodingError('TASK_NOT_FOUND', 'Coding task not found', 404);
  await repo.updateTaskWithQuestions(
    taskId,
    {
      title: input.title,
      description: input.description,
      difficulty: input.difficulty,
      visible: input.visible,
    },
    input.questions,
  );
  return findAdminTask(taskId);
}

export async function removeTask(taskId: string): Promise<void> {
  const existing = await repo.findTaskById(taskId);
  if (!existing) throw new CodingError('TASK_NOT_FOUND', 'Coding task not found', 404);
  await repo.deleteTask(taskId);
}

export async function listTaskSubmissions(taskId: string): Promise<CodingSubmissionAdminView[]> {
  const task = await repo.findTaskById(taskId);
  if (!task) throw new CodingError('TASK_NOT_FOUND', 'Coding task not found', 404);
  const rows = await repo.listSubmissionsForTask(taskId);
  return rows.map((r) => ({
    ...toSubmissionView(r),
    userId: r.userId,
    studentName: r.studentName,
    studentEmail: r.studentEmail,
    questionTitle: r.questionTitle ?? 'Question',
  }));
}

async function findAdminTask(taskId: string): Promise<CodingTaskAdminView> {
  const all = await listTasksAdmin();
  const found = all.find((t) => t.id === taskId);
  if (!found) throw new CodingError('TASK_NOT_FOUND', 'Coding task not found', 404);
  return found;
}
