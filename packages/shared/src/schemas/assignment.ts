import { z } from 'zod';

/**
 * Personalized onboarding assignment. Generated once per student by the AI from
 * their profile, then cached in the DB. A "mixed" assignment combines:
 *  - `mcq`          — auto-scored multiple choice (has `options` + `correctIndex`)
 *  - `practice`     — a concrete task the student self-marks done
 *  - `short_answer` — a free-text reflection
 * On completion the student also answers `closingQuestions` (general questions) —
 * together these drive the AI roadmap. These schemas double as the validation
 * contract for the model's JSON output, so the model can never feed us junk.
 */

export const AssignmentTaskTypeSchema = z.enum(['mcq', 'practice', 'short_answer']);
export type AssignmentTaskType = z.infer<typeof AssignmentTaskTypeSchema>;

export const AssignmentStatusSchema = z.enum(['ready', 'completed']);
export type AssignmentStatus = z.infer<typeof AssignmentStatusSchema>;

/** A single task as produced by the AI (internal — may carry the MCQ answer key). */
export const assignmentTaskSchema = z.object({
  key: z.string().trim().min(1).max(64),
  type: AssignmentTaskTypeSchema,
  title: z.string().trim().min(1).max(200),
  prompt: z.string().trim().min(1).max(2000),
  skillIds: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  options: z.array(z.string().trim().min(1).max(300)).min(2).max(6).optional(),
  correctIndex: z.number().int().min(0).max(5).optional(),
  estimatedMin: z.number().int().min(1).max(600).optional(),
});
export type AssignmentTask = z.infer<typeof assignmentTaskSchema>;

export const assignmentClosingQuestionSchema = z.object({
  key: z.string().trim().min(1).max(64),
  prompt: z.string().trim().min(1).max(500),
});
export type AssignmentClosingQuestion = z.infer<typeof assignmentClosingQuestionSchema>;

/** The full AI output contract for an assignment. */
export const assignmentSpecSchema = z.object({
  summary: z.string().trim().min(1).max(1000),
  tasks: z.array(assignmentTaskSchema).min(1).max(20),
  closingQuestions: z.array(assignmentClosingQuestionSchema).min(1).max(8),
});
export type AssignmentSpec = z.infer<typeof assignmentSpecSchema>;

// --- Client view (answer keys stripped) ---

export const assignmentTaskViewSchema = assignmentTaskSchema.omit({ correctIndex: true });
export type AssignmentTaskView = z.infer<typeof assignmentTaskViewSchema>;

export type AssignmentView = {
  id: string;
  status: AssignmentStatus;
  summary: string;
  tasks: AssignmentTaskView[];
  closingQuestions: AssignmentClosingQuestion[];
  score: number | null;
  completedAt: string | null;
};

/** Cheap status check — does NOT generate an assignment (no AI call). */
export type AssignmentStatusView = {
  exists: boolean;
  status: AssignmentStatus | null;
  score: number | null;
};

// --- Submission (student input) ---

export const assignmentTaskAnswerSchema = z.object({
  key: z.string().trim().min(1).max(64),
  /** MCQ → chosen option index (number); short_answer/practice → text. */
  answer: z.union([z.string().trim().max(4000), z.number().int().min(0).max(5)]),
  selfMarkedDone: z.boolean().optional(),
});
export type AssignmentTaskAnswer = z.infer<typeof assignmentTaskAnswerSchema>;

export const assignmentClosingAnswerSchema = z.object({
  key: z.string().trim().min(1).max(64),
  answer: z.string().trim().min(1).max(4000),
});
export type AssignmentClosingAnswer = z.infer<typeof assignmentClosingAnswerSchema>;

export const assignmentSubmissionSchema = z.object({
  taskAnswers: z.array(assignmentTaskAnswerSchema).max(20),
  closingAnswers: z.array(assignmentClosingAnswerSchema).max(8),
});
export type AssignmentSubmission = z.infer<typeof assignmentSubmissionSchema>;

/** What the student persisted, kept alongside the spec for the roadmap step. */
export type AssignmentResponses = {
  taskAnswers: AssignmentTaskAnswer[];
  closingAnswers: AssignmentClosingAnswer[];
};
