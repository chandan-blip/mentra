import { z } from 'zod';
import { generateJson } from '../../core/ai.js';
import { getPromptConfig } from '../ai-prompt/ai-prompt.service.js';
import { PROMPT_KEYS } from '../ai-prompt/ai-prompt.registry.js';

/**
 * Groq-generated cover copy for a live-session thumbnail. We only ask the model for text
 * + a constrained accent (never an image): a fixed HTML template renders it. Output is
 * forced to JSON and validated here; callers cache the rendered image in R2 and never
 * call speculatively (only on session create/end).
 */

/** Accent is restricted to a vetted palette so the render is always on-brand + legible. */
export const THUMBNAIL_ACCENTS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f97316', // orange
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#ef4444', // red
  '#14b8a6', // teal
] as const;

export const thumbnailCopySchema = z.object({
  /** Big punchy headline — 2–5 words, no trailing punctuation. */
  headline: z.string().trim().min(1).max(48),
  /** Short supporting kicker/subtitle — one phrase. */
  kicker: z.string().trim().min(1).max(72),
  /** Accent color, one of the vetted palette. */
  accent: z.enum(THUMBNAIL_ACCENTS),
  /** A single topical emoji for the corner badge. */
  emoji: z.string().trim().min(1).max(8),
});

export type ThumbnailCopy = z.infer<typeof thumbnailCopySchema>;

export type ThumbnailContext = {
  title: string;
  topic: string;
  /** Chat comment bodies (end phase only) — used as extra flavor, may be empty. */
  comments?: string[];
};

/** Ask Groq for validated cover copy. Throws `AiError` on transport/parse/shape failure. */
export async function generateThumbnailCopy(ctx: ThumbnailContext): Promise<ThumbnailCopy> {
  const comments = (ctx.comments ?? [])
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 40);
  const user = [
    `Title: ${ctx.title}`,
    `Topic: ${ctx.topic}`,
    comments.length
      ? `Audience chat (for flavor, do not quote verbatim):\n${comments.map((c) => `- ${c}`).join('\n')}`
      : 'Audience chat: (none yet)',
  ].join('\n');

  const cfg = await getPromptConfig(PROMPT_KEYS.thumbnailCopy);
  const system = cfg.system.replaceAll('{ACCENTS}', THUMBNAIL_ACCENTS.join(', '));
  return generateJson({ system, user, schema: thumbnailCopySchema, temperature: cfg.temperature });
}
