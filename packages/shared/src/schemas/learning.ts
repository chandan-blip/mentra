import { z } from 'zod';

/**
 * Learning module (test series). Categories are AI-generated per student from their
 * roadmap + profile; each category is a Beginner→Intermediate→Advanced ladder of MCQ
 * tests. These schemas are the AI generation contracts + the request bodies.
 */

export const LearningDifficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);
export type LearningDifficulty = z.infer<typeof LearningDifficultySchema>;

export const LearningTestQuestionTypeSchema = z.enum(['single_choice', 'multi_choice']);
export type LearningTestQuestionType = z.infer<typeof LearningTestQuestionTypeSchema>;

// --- Category generation (AI) ---

/**
 * Validation contract for the AI category generator. The model proposes a curated set
 * of test-series categories tailored to the student's roadmap topics + goals (e.g.
 * "Interview Prep", "OOP Concepts", "DevOps", "CI/CD"). `slug` is a stable kebab-case
 * key used to de-duplicate on regeneration.
 */
export const learningCategoryGenItemSchema = z.object({
  slug: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(240),
  skillTags: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
  /** One line on what mastering this helps the student do. */
  benefit: z.string().trim().max(200).default(''),
  /** A few short example projects where this topic applies (e.g. "REST API backend"). */
  projects: z.array(z.string().trim().min(1).max(80)).max(4).default([]),
});
export type LearningCategoryGenItem = z.infer<typeof learningCategoryGenItemSchema>;

export const learningCategoriesGenSchema = z.object({
  categories: z.array(learningCategoryGenItemSchema).min(1).max(12),
});
export type LearningCategoriesGenInput = z.infer<typeof learningCategoriesGenSchema>;

// --- Test question generation (AI) ---

export const learningTestQuestionGenSchema = z.object({
  type: LearningTestQuestionTypeSchema,
  body: z.string().trim().min(1).max(2000),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
  correct: z.array(z.number().int().min(0).max(5)).min(1).max(6),
  explanation: z.string().trim().max(1000).optional(),
  points: z.number().int().min(1).max(10).default(1),
});
export type LearningTestQuestionGen = z.infer<typeof learningTestQuestionGenSchema>;

export const learningTestGenSchema = z.object({
  questions: z.array(learningTestQuestionGenSchema).min(1).max(30),
});
export type LearningTestGenInput = z.infer<typeof learningTestGenSchema>;

/**
 * Wide variant for custom quizzes, which let the student pick 10–100 questions (the
 * standard ladder generator is capped at 30 per rung).
 */
export const customLearningTestGenSchema = z.object({
  /** One line on what this quiz helps the student do. */
  benefit: z.string().trim().max(200).default(''),
  /** A few short example projects where this topic applies. */
  projects: z.array(z.string().trim().min(1).max(80)).max(4).default([]),
  questions: z.array(learningTestQuestionGenSchema).min(1).max(100),
});
export type CustomLearningTestGenInput = z.infer<typeof customLearningTestGenSchema>;

// --- Requests ---

/**
 * Request body for the "build your own" custom quiz. The student names a topic, sets an
 * experience level (0–10), optionally picks languages/tech to bias the questions, and
 * chooses how many questions (10–100). The server serves an existing shared quiz keyed by
 * topic + experience bucket, or generates and caches a new one for everyone.
 */
export const customLearningRequestSchema = z.object({
  topic: z.string().trim().min(2).max(80),
  experienceLevel: z.number().int().min(0).max(10),
  languages: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  questionCount: z.number().int().min(10).max(100),
});
export type CustomLearningRequestInput = z.infer<typeof customLearningRequestSchema>;

/** Request body for submitting a learning-test attempt. */
export const submitLearningTestSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().trim().min(1).max(191),
        selected: z.array(z.number().int().min(0).max(5)).max(6),
      }),
    )
    .min(1)
    .max(30),
});
export type SubmitLearningTestInput = z.infer<typeof submitLearningTestSchema>;
