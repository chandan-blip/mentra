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

/** Max size for a mentor-uploaded recording (5 GB). Enforced client- and server-side. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

/** Mentor starts an upload — returns a presigned URL; the browser PUTs the file to R2. */
export const createUploadSchema = z.object({
  title: z.string().trim().min(1).max(200),
  topic: z.string().trim().min(1).max(120).default('General'),
  /** MIME type of the file being uploaded (e.g. video/mp4). */
  contentType: z.string().trim().min(1).max(120),
});
export type CreateUploadInput = z.infer<typeof createUploadSchema>;

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
  /** Servable avatar URL of the mentor (relative path), or null if none uploaded. */
  mentorAvatarUrl: string | null;
  title: string;
  topic: string;
  status: LiveSessionStatus;
  scheduledFor: string | null;
  startedAt: string | null;
  endedAt: string | null;
  currentViewers: number;
  peakViewers: number;
  /** Number of chat messages on the session (used as the "comments" count). */
  chatCount: number;
  /** True when the requesting user is the owning mentor. */
  isOwner: boolean;
  /** Recording lifecycle: null (none) → recording → processing → ready | failed. */
  recordingStatus: 'recording' | 'processing' | 'ready' | 'failed' | null;
  /** HLS master playlist URL (CDN-served) — present only when recordingStatus is 'ready'. */
  recordingUrl: string | null;
  /** AI-designed cover image URL (Groq + Puppeteer), or null until generated. Preferred
   * over the recording frame-grab poster on cards. */
  thumbnailUrl: string | null;
  /** Managed in the Videos module — false hides the video from student feeds/watch pages. */
  visible: boolean;
  /** Public videos are watchable by anyone (even logged-out) at /watch/:id. */
  isPublic: boolean;
  /** Playback duration in seconds (recordings/uploads), or null until transcoded. */
  durationSeconds: number | null;
  /** 'live' (recorded broadcast) or 'upload' (mentor-uploaded video). */
  source: 'live' | 'upload';
  /** Total likes on the session. */
  likeCount: number;
  /** Whether the requesting user has liked this session. */
  likedByViewer: boolean;
  createdAt: string;
};

/** A live session the student attended, plus their aggregate attendance. */
export type AttendedSessionView = LiveSessionView & {
  /** Total seconds the student was present, summed across joins. */
  attendedSeconds: number;
  /** ISO time of the student's most recent join. */
  attendedAt: string;
};

/** Returned by like / unlike — lets the client update the button + count in place. */
export type LikeResultView = {
  liked: boolean;
  likes: number;
};

/** Returned when a mentor starts an upload: the row + a presigned R2 PUT URL. */
export type UploadInitResponse = {
  session: LiveSessionView;
  uploadUrl: string;
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
