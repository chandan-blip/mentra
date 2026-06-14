import { z } from 'zod';

// --- Enums (mirror DB enums) ---

export const SkillCategorySchema = z.enum([
  'language',
  'framework',
  'tool',
  'concept',
  'dsa',
  'system_design',
  'soft_skill',
  'domain',
]);
export type SkillCategory = z.infer<typeof SkillCategorySchema>;

export const QuestionTypeSchema = z.enum(['single_choice', 'multi_choice', 'numeric', 'short_text']);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const TemplateTypeSchema = z.enum(['initial', 'periodic', 'topic']);
export type TemplateType = z.infer<typeof TemplateTypeSchema>;

export const AttemptStatusSchema = z.enum([
  'in_progress',
  'completed',
  'abandoned',
  'auto_completed',
]);
export type AttemptStatus = z.infer<typeof AttemptStatusSchema>;

// --- Request schemas ---

export const startAssessmentSchema = z.object({
  templateId: z.string().trim().min(1).max(191),
});
export type StartAssessmentInput = z.infer<typeof startAssessmentSchema>;

/** Answer payload — shape depends on question type; validated against type in the service. */
export const answerSelectedSchema = z.union([
  z.object({ optionIds: z.array(z.string().min(1)).min(1).max(20) }),
  z.object({ value: z.number() }),
  z.object({ text: z.string().max(5000) }),
]);
export type AnswerSelected = z.infer<typeof answerSelectedSchema>;

export const submitAnswerSchema = z.object({
  questionId: z.string().trim().min(1).max(191),
  selected: answerSelectedSchema,
  timeSpentMs: z.number().int().min(0).max(86_400_000).default(0),
});
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
