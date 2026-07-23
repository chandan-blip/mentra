import { z } from 'zod';

/**
 * Coding module. Managers author coding TASKS — a task is a set of QUESTIONS (each a
 * self-contained problem: statement + allowed languages + stdin/stdout test cases).
 * Students open a task and solve its questions in an in-app editor; on submit the code is
 * executed against every test case in a sandbox and marked correct/wrong from the pass/fail
 * result, with a short AI review comment layered on top.
 *
 * These schemas are the request bodies (create/update/submit) + the AI review contract.
 * The read-model (`*View`) types below are shared by the API and web.
 */

/**
 * Languages a student can pick in the editor. The module is JavaScript-only: submissions
 * run in an in-process QuickJS (WASM) sandbox API-side (see coding.exec), so no external
 * runtime is needed. Kept as an enum so the type/UI can grow again later if desired.
 */
export const CodingLanguageSchema = z.enum(['javascript']);
export type CodingLanguage = z.infer<typeof CodingLanguageSchema>;

export const CodingDifficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);
export type CodingDifficulty = z.infer<typeof CodingDifficultySchema>;

/**
 * One test case: `input` is exposed to the student's JS as the global `input` string (plus
 * `readLine()`/`readInt()` helpers); the program's `console.log`/`print` output, trimmed, is
 * compared to `expectedOutput`. `hidden` test cases are graded but never revealed to the student.
 */
export const codingTestCaseSchema = z.object({
  input: z.string().max(20_000).default(''),
  expectedOutput: z.string().max(20_000).default(''),
  hidden: z.boolean().default(false),
});
export type CodingTestCaseInput = z.infer<typeof codingTestCaseSchema>;

/** One question within a task — a self-contained problem with its own languages + tests. */
export const codingQuestionSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(20_000),
  languages: z.array(CodingLanguageSchema).min(1).max(8),
  starterCode: z.string().max(20_000).default(''),
  testCases: z.array(codingTestCaseSchema).min(1).max(20),
});
export type CodingQuestionInput = z.infer<typeof codingQuestionSchema>;

export const createCodingTaskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  /** Optional short overview shown above the question list. */
  description: z.string().trim().max(2_000).default(''),
  difficulty: CodingDifficultySchema.default('beginner'),
  visible: z.boolean().default(true),
  questions: z.array(codingQuestionSchema).min(1).max(50),
});
export type CreateCodingTaskInput = z.infer<typeof createCodingTaskSchema>;

export const updateCodingTaskSchema = createCodingTaskSchema.partial();
export type UpdateCodingTaskInput = z.infer<typeof updateCodingTaskSchema>;

export const submitCodingSchema = z.object({
  language: CodingLanguageSchema,
  code: z.string().trim().min(1).max(100_000),
});
export type SubmitCodingInput = z.infer<typeof submitCodingSchema>;

/** AI review contract — a short human-style comment + a rough quality score (0-100). */
export const codingReviewSchema = z.object({
  feedback: z.string().trim().max(2_000),
  quality: z.number().int().min(0).max(100).default(0),
  suggestions: z.array(z.string().trim().min(1).max(400)).max(5).default([]),
});
export type CodingReview = z.infer<typeof codingReviewSchema>;

// --- Read models (shared by API + web) ---

export type CodingSubmissionStatus = 'passed' | 'failed' | 'error';

/** Per test-case grading detail. Hidden cases expose only pass/fail (never their I/O). */
export type CodingTestResultView = {
  index: number;
  passed: boolean;
  hidden: boolean;
  input: string;
  expected: string;
  actual: string;
  stderr: string;
};

export type CodingSubmissionView = {
  id: string;
  taskId: string;
  questionId: string;
  language: CodingLanguage;
  code: string;
  status: CodingSubmissionStatus;
  passedCount: number;
  totalCount: number;
  percent: number;
  results: CodingTestResultView[];
  aiFeedback: string | null;
  createdAt: string;
};

/** A student's status for one question or task (drives the lists). */
export type CodingStatus = 'not_started' | 'attempted' | 'passed';

export type CodingTaskListItem = {
  id: string;
  title: string;
  difficulty: CodingDifficulty;
  questionCount: number;
  solvedCount: number;
  status: CodingStatus;
  /** Solved questions / total questions, as a percentage. */
  percent: number;
};

/** One question inside a task detail — hidden test cases are stripped to pass/fail only. */
export type CodingQuestionDetail = {
  id: string;
  title: string;
  description: string;
  languages: CodingLanguage[];
  starterCode: string;
  /** Only the non-hidden ("sample") test cases, shown to the student. */
  sampleTestCases: { input: string; expectedOutput: string }[];
  status: CodingStatus;
  lastSubmission: CodingSubmissionView | null;
};

export type CodingTaskDetail = {
  id: string;
  title: string;
  description: string;
  difficulty: CodingDifficulty;
  questions: CodingQuestionDetail[];
};

/** Aggregate coding stats for a student (the "correct percentage" header). */
export type CodingProgressView = {
  totalQuestions: number;
  attempted: number;
  solved: number;
  correctPercent: number;
};

// --- Manager (admin) read models ---

export type CodingTestCaseView = { input: string; expectedOutput: string; hidden: boolean };

export type CodingQuestionAdminView = {
  id: string;
  title: string;
  description: string;
  languages: CodingLanguage[];
  starterCode: string;
  testCases: CodingTestCaseView[];
};

export type CodingTaskAdminView = {
  id: string;
  title: string;
  description: string;
  difficulty: CodingDifficulty;
  visible: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  questions: CodingQuestionAdminView[];
  /** Roll-up across submissions for all the task's questions. */
  stats: { submissions: number; students: number; solved: number };
};

export type CodingSubmissionAdminView = CodingSubmissionView & {
  userId: string;
  studentName: string | null;
  studentEmail: string | null;
  questionTitle: string;
};
