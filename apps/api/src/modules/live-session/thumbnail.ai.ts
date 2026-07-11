import { z } from 'zod';
import { generateJson } from '../../core/ai.js';

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

const SYSTEM = [
  'You are a thumbnail copywriter for an online learning platform.',
  'Given a live class title, topic, and (optionally) audience chat, produce punchy',
  'YouTube-style cover copy. Respond with a SINGLE JSON object and NOTHING else.',
  'Rules:',
  '- headline: 2 to 5 words, bold and specific, Title Case, NO trailing punctuation.',
  '- kicker: one short supporting phrase (max ~8 words).',
  `- accent: EXACTLY one of ${THUMBNAIL_ACCENTS.join(', ')} — pick what fits the mood.`,
  '- emoji: exactly one emoji that matches the topic.',
  'Never include hashtags, quotes around the whole value, or markdown.',
].join('\n');

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

  return generateJson({ system: SYSTEM, user, schema: thumbnailCopySchema, temperature: 0.6 });
}
