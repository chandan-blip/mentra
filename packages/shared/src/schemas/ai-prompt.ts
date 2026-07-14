import { z } from 'zod';

/**
 * AI prompt tuning — the FE+BE contract for the manager-facing `manage-ai-prompts`
 * module. Every AI feature's system prompt + temperature lives in a code-owned
 * registry (the default); a manager can override any of them, stored in the
 * `AiPrompt` table and merged over the default at call time. Reset = drop the row.
 */

/** One tunable prompt: the registry metadata + its effective (possibly overridden) values. */
export type AiPromptView = {
  /** Stable key, e.g. "mentor.match". */
  key: string;
  /** Human label for the manager UI. */
  label: string;
  /** Feature group the prompt belongs to, e.g. "Roadmap". */
  group: string;
  /** One line on what this prompt drives. */
  description: string;
  /** Template tokens the text may contain (must be preserved), e.g. ["{MIN}", "{MAX}"]. */
  variables: string[];
  /** Effective system prompt (override if set, else default). */
  system: string;
  /** Effective sampling temperature (override if set, else default). */
  temperature: number;
  /** The pristine, code-owned default system prompt. */
  defaultSystem: string;
  /** The pristine, code-owned default temperature. */
  defaultTemperature: number;
  /** True when a manager override is stored for this key. */
  isCustomized: boolean;
  /** When the override was last saved (ISO), or null if never customized. */
  updatedAt: string | null;
  /** Name of the manager who last saved the override, or null. */
  updatedBy: string | null;
};

/** Manager saves an override for one prompt. */
export const updateAiPromptSchema = z.object({
  systemPrompt: z.string().trim().min(1).max(20000),
  temperature: z.number().min(0).max(2),
});
export type UpdateAiPromptInput = z.infer<typeof updateAiPromptSchema>;
