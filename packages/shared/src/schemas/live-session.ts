import { z } from 'zod';

/**
 * Live sessions — mentors broadcast, students attend. Media runs on a self-hosted
 * LiveKit SFU (Mentra only mints room tokens). These schemas are the FE+BE contract
 * for the REST surface; realtime chat/presence flows over Socket.IO (see socket types).
 */

export const LiveSessionStatusSchema = z.enum(['scheduled', 'live', 'ended', 'canceled']);
export type LiveSessionStatus = z.infer<typeof LiveSessionStatusSchema>;

/** Mentor creates a session — go live now (no scheduledFor) or schedule for later. */
export const createLiveSessionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  topic: z.string().trim().min(1).max(120).default('General'),
  // ISO datetime; omit/null to start immediately on `go live`.
  scheduledFor: z.string().datetime().nullable().optional(),
});
export type CreateLiveSessionInput = z.infer<typeof createLiveSessionSchema>;

/** Edit a scheduled session (title/topic/time). */
export const updateLiveSessionSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  topic: z.string().trim().min(1).max(120).optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
});
export type UpdateLiveSessionInput = z.infer<typeof updateLiveSessionSchema>;

/** A chat message sent over Socket.IO. */
export const chatSendSchema = z.object({
  sessionId: z.string().trim().min(1).max(191),
  body: z.string().trim().min(1).max(1000),
});
export type ChatSendInput = z.infer<typeof chatSendSchema>;

// --- Views returned by the API ---

export type LiveSessionView = {
  id: string;
  mentorId: string;
  mentorName: string;
  title: string;
  topic: string;
  status: LiveSessionStatus;
  scheduledFor: string | null;
  startedAt: string | null;
  endedAt: string | null;
  currentViewers: number;
  peakViewers: number;
  /** True when the requesting user is the owning mentor. */
  isOwner: boolean;
  createdAt: string;
};

export type ChatMessageView = {
  id: string;
  sessionId: string;
  authorUserId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

/** What a client needs to connect to the LiveKit room. */
export type JoinTokenResponse = {
  token: string;
  /** Public LiveKit websocket URL the browser connects to. */
  wsUrl: string;
  room: string;
  /** True if this token can publish (mentor/owner, or a promoted student). */
  canPublish: boolean;
};

/** Post-session analytics for the owning mentor. */
export type SessionAttendee = {
  userId: string;
  name: string;
  attendedSeconds: number;
  firstJoin: string;
  lastSeen: string;
};

export type SessionSummary = {
  session: {
    id: string;
    title: string;
    topic: string;
    status: LiveSessionStatus;
    startedAt: string | null;
    endedAt: string | null;
    peakViewers: number;
  };
  chatCount: number;
  attendees: SessionAttendee[];
};
