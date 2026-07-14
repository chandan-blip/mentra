import { z } from 'zod';
import { generateChatJson, type AiChatMessage } from '../../core/ai.js';
import { getPromptConfig, PROMPT_KEYS } from '../ai-prompt/index.js';

/**
 * The mentor-chat coach turn. Given the conversation so far (plus a small profile
 * context block) it returns the coach's next human-sounding reply and whether now is
 * a good moment to surface a live-session invite. Output is JSON-validated; the
 * booleans/strings use `.catch` so one odd field never fails the whole turn.
 */
export const chatReplySchema = z.object({
  reply: z.string().min(1).max(2000),
  suggestSession: z.boolean().catch(false),
  sessionQuery: z.string().trim().max(60).nullable().catch(null),
});

export type ChatReply = z.infer<typeof chatReplySchema>;

/** Prior turns, oldest-first: 'student' → user, coach → assistant. */
export type HistoryTurn = { role: 'student' | 'mentor'; body: string };

/**
 * Injected as the LATEST turn (user role) when the student has gone quiet, so the model
 * answers TO this instruction with a genuinely new line instead of continuing/echoing its
 * own last message (a trailing system note tends to get parroted).
 */
const NUDGE_DIRECTIVE =
  "[The student has gone quiet and hasn't replied. As their mentor, send ONE short, warm follow-up " +
  'to re-engage them about what you were just discussing. It MUST be clearly DIFFERENT from your ' +
  "previous message and from any question you've already asked — come at it from a new angle, narrow " +
  'it, lighten it, or reassure them ("no rush — even a rough idea helps"). Do NOT answer for them, do ' +
  'NOT repeat yourself, do NOT open a big new topic, keep it in their language, and set suggestSession to false.]';

export async function generateCoachReply(input: {
  coachName: string;
  profileContext: string;
  history: HistoryTurn[];
  /** True when this turn is a proactive idle nudge rather than a reply to the student. */
  nudge?: boolean;
}): Promise<ChatReply> {
  const cfg = await getPromptConfig(PROMPT_KEYS.careerChat);
  const system = cfg.system.replaceAll('{COACH}', input.coachName);

  const messages: AiChatMessage[] = [
    { role: 'system', content: system },
    // A lightweight context block the coach can lean on but shouldn't parrot back.
    { role: 'system', content: `Student context (for your reference only):\n${input.profileContext}` },
    ...input.history.map<AiChatMessage>((t) => ({
      role: t.role === 'student' ? 'user' : 'assistant',
      content: t.body,
    })),
    // The nudge goes last as a USER turn so the model replies to it with a new line
    // rather than continuing (and echoing) its own previous assistant message.
    ...(input.nudge ? [{ role: 'user' as const, content: NUDGE_DIRECTIVE }] : []),
  ];

  // Nudge a touch hotter so repeated prods don't converge on the same phrasing.
  const temperature = input.nudge ? Math.min(1, cfg.temperature + 0.15) : cfg.temperature;
  return generateChatJson({ messages, schema: chatReplySchema, temperature });
}
