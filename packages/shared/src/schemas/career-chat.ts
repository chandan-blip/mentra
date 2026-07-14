import { z } from 'zod';

/**
 * "Chat with your Mentor" — the FE+BE contract for the student career-coach module.
 *
 * The student chats with what reads as a real human mentor; it is powered by the AI
 * behind the scenes. The coach answers career questions (landing a first job, interview
 * prep, where to find openings, what each role needs) and, when relevant, drops in a
 * `session-invite` message: a card for a real upcoming mentor live session with an
 * Enroll button. Enrolling likes the session and posts an "Enrolled!" comment as the
 * student, reusing the live-session reactions.
 */

export type CareerChatRole = 'student' | 'mentor';
export type CareerChatKind = 'text' | 'session-invite';

/** The upcoming live session attached to a `session-invite` message. */
export type CareerChatSessionCard = {
  id: string;
  title: string;
  topic: string;
  /** The real mentor who created the session — the invite is attributed to them. */
  mentorName: string;
  mentorAvatarUrl: string | null;
  scheduledFor: string | null;
  likeCount: number;
  chatCount: number;
  /** True once this student has enrolled (auto-liked + commented) on the session. */
  enrolled: boolean;
};

/** One message in the conversation. */
export type CareerChatMessageView = {
  id: string;
  role: CareerChatRole;
  kind: CareerChatKind;
  body: string;
  /** Display name of the speaker (coach persona for mentor turns, else the student). */
  authorName: string;
  authorAvatarUrl: string | null;
  createdAt: string;
  /** Present only on `session-invite` messages. */
  session: CareerChatSessionCard | null;
};

/** Student sends a message to the coach. */
export const sendCareerChatSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
export type SendCareerChatInput = z.infer<typeof sendCareerChatSchema>;

/** Student taps Enroll on a session-invite card. */
export const enrollCareerChatSchema = z.object({
  sessionId: z.string().min(1),
});
export type EnrollCareerChatInput = z.infer<typeof enrollCareerChatSchema>;
