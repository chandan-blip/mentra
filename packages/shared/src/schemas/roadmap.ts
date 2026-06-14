import { z } from 'zod';

export const RoadmapStatusSchema = z.enum(['active', 'archived', 'superseded']);
export type RoadmapStatus = z.infer<typeof RoadmapStatusSchema>;

export const RoadmapItemTypeSchema = z.enum([
  'topic',
  'project',
  'assessment',
  'session',
  'reading',
  'practice',
]);
export type RoadmapItemType = z.infer<typeof RoadmapItemTypeSchema>;

export const RoadmapItemStatusSchema = z.enum([
  'locked',
  'available',
  'in_progress',
  'completed',
  'skipped',
]);
export type RoadmapItemStatus = z.infer<typeof RoadmapItemStatusSchema>;

/**
 * Validation contract for a roadmap *plan* — the structure a generator (incl. the
 * AI generator) must produce. Mirrors `RoadmapPlan` in the api's roadmap generator
 * types; `skillIds`/`dependsOn` default to empty so the model may omit them.
 */
export const roadmapPlanItemSchema = z.object({
  key: z.string().trim().min(1).max(64),
  type: RoadmapItemTypeSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  skillIds: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  estimatedMin: z.number().int().min(1).max(600).optional(),
  dependsOn: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
});
export type RoadmapPlanItemInput = z.infer<typeof roadmapPlanItemSchema>;

export const roadmapPlanWeekSchema = z.object({
  weekNumber: z.number().int().min(1).max(52),
  title: z.string().trim().min(1).max(200),
  theme: z.string().trim().max(200).optional(),
  items: z.array(roadmapPlanItemSchema).min(1).max(12),
});
export type RoadmapPlanWeekInput = z.infer<typeof roadmapPlanWeekSchema>;

export const roadmapPlanSchema = z.object({
  totalWeeks: z.number().int().min(1).max(52),
  weeks: z.array(roadmapPlanWeekSchema).min(1).max(52),
  notes: z.string().trim().max(2000).optional(),
});
export type RoadmapPlanInput = z.infer<typeof roadmapPlanSchema>;

export const regenerateRoadmapSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});
export type RegenerateRoadmapInput = z.infer<typeof regenerateRoadmapSchema>;

// --- Topic subtopics (AI-generated on demand) ---

/**
 * Validation contract for the AI subtopic breakdown of a single topic. The model
 * returns the *complete* set of subtopics a student must learn for the topic, so
 * they never have to decide the scope themselves. Persisted one row per subtopic.
 */
export const roadmapSubtopicGenItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  estimatedMin: z.number().int().min(1).max(600).optional(),
});
export type RoadmapSubtopicGenItem = z.infer<typeof roadmapSubtopicGenItemSchema>;

export const roadmapSubtopicsGenSchema = z.object({
  subtopics: z.array(roadmapSubtopicGenItemSchema).min(1).max(20),
});
export type RoadmapSubtopicsGenInput = z.infer<typeof roadmapSubtopicsGenSchema>;

// --- Topic test (AI-generated on demand) ---

export const RoadmapTestStatusSchema = z.enum(['ready', 'in_progress', 'completed']);
export type RoadmapTestStatus = z.infer<typeof RoadmapTestStatusSchema>;

export const RoadmapTestQuestionTypeSchema = z.enum(['single_choice', 'multi_choice']);
export type RoadmapTestQuestionType = z.infer<typeof RoadmapTestQuestionTypeSchema>;

/**
 * Validation contract for the AI test generator. The model must produce a question
 * for every subtopic of the topic so the test covers the whole thing. `subtopicTitle`
 * lets the service map each question back to a stored subtopic row.
 */
export const roadmapTestQuestionGenSchema = z.object({
  subtopicTitle: z.string().trim().max(200).optional(),
  type: RoadmapTestQuestionTypeSchema,
  body: z.string().trim().min(1).max(2000),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
  correct: z.array(z.number().int().min(0).max(5)).min(1).max(6),
  explanation: z.string().trim().max(1000).optional(),
  points: z.number().int().min(1).max(10).default(1),
});
export type RoadmapTestQuestionGen = z.infer<typeof roadmapTestQuestionGenSchema>;

export const roadmapTestGenSchema = z.object({
  questions: z.array(roadmapTestQuestionGenSchema).min(1).max(60),
});
export type RoadmapTestGenInput = z.infer<typeof roadmapTestGenSchema>;

/** Request body for submitting a topic test attempt. */
export const submitRoadmapTestSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().trim().min(1).max(191),
        selected: z.array(z.number().int().min(0).max(5)).max(6),
      }),
    )
    .min(1)
    .max(60),
});
export type SubmitRoadmapTestInput = z.infer<typeof submitRoadmapTestSchema>;
