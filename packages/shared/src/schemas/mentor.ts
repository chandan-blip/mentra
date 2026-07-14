import { z } from 'zod';
import type { JoinTokenResponse } from './live-session.js';

/**
 * Mentorship — students browse AI-matched mentors, book PAID 1:1 or group sessions
 * against published availability slots, pay via a (demo) checkout that an accountant
 * approves, then join a LiveKit call by code; sessions end with feedback. These
 * schemas are the FE+BE contract for the REST surface under /api/v1/mentor.
 */

/** A slot is a private 1:1 or a capacity-limited group session. */
export const SlotKindSchema = z.enum(['one_to_one', 'group']);
export type SlotKind = z.infer<typeof SlotKindSchema>;

/**
 * Billing access for a slot. `paid` = student pays per session (checkout → accountant).
 * `casual` = covered by a Mentra subscription; only subscribers can book, free of charge.
 */
export const SlotAccessSchema = z.enum(['paid', 'casual']);
export type SlotAccess = z.infer<typeof SlotAccessSchema>;

// --- Inputs ---

/** Mentor edits their public profile (mentor-side). */
export const upsertMentorProfileSchema = z.object({
  headline: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(1000).optional(),
  expertise: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  techStack: z.array(z.string().trim().min(1).max(40)).max(40).optional(),
  yearsExperience: z.number().int().min(0).max(60).nullable().optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  accepting: z.boolean().optional(),
  /** Flat price per session, in paise/cents (₹ = /100). 0 = free. */
  sessionPriceCents: z.number().int().min(0).max(100_000_00).optional(),
  /** Prompt shown to students in the end-of-session feedback form. */
  feedbackPrompt: z.string().trim().max(500).optional(),
});
export type UpsertMentorProfileInput = z.infer<typeof upsertMentorProfileSchema>;

/** Mentor publishes a bookable slot (mentor-side). */
export const createSlotSchema = z
  .object({
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    kind: SlotKindSchema.default('one_to_one'),
    /** Seats; forced to 1 for one_to_one server-side. */
    capacity: z.number().int().min(1).max(500).default(1),
    /** Paid (per-session checkout) or casual (subscriber-only, free). */
    access: SlotAccessSchema.default('paid'),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  });
export type CreateSlotInput = z.infer<typeof createSlotSchema>;

/** Student books an open slot. */
export const createBookingSchema = z.object({
  slotId: z.string().trim().min(1).max(191),
  topic: z.string().trim().min(1).max(200),
  note: z.string().trim().max(1000).optional(),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

/** Student (or mentor) posts an async doubt message. The thread is resolved/created
 *  server-side from the (mentor, student) pair, so callers only pass the mentor. */
export const sendDoubtSchema = z.object({
  mentorId: z.string().trim().min(1).max(191),
  body: z.string().trim().min(1).max(2000),
});
export type SendDoubtInput = z.infer<typeof sendDoubtSchema>;

/** Mentor replies within an existing thread. */
export const replyDoubtSchema = z.object({
  threadId: z.string().trim().min(1).max(191),
  body: z.string().trim().min(1).max(2000),
});
export type ReplyDoubtInput = z.infer<typeof replyDoubtSchema>;

/** Student submits end-of-session feedback. */
export const submitFeedbackSchema = z.object({
  bookingId: z.string().trim().min(1).max(191),
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

/** Join a booked session by its short code. */
export const joinByCodeSchema = z.object({
  code: z.string().trim().min(1).max(12),
});
export type JoinByCodeInput = z.infer<typeof joinByCodeSchema>;

// --- Views returned by the API ---

export type SlotStatus = 'open' | 'booked' | 'cancelled';
export type BookingStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'completed' | 'rejected';
/** Payment lifecycle mirrored onto the booking for the student's view. */
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'refunded' | null;

export type MentorView = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  expertise: string[];
  techStack: string[];
  yearsExperience: number | null;
  timezone: string;
  accepting: boolean;
  /** Count of future, still-open availability slots. */
  openSlotCount: number;
  /** Flat price per session in paise/cents (₹ = /100). */
  sessionPriceCents: number;
  feedbackPrompt: string | null;
};

/** A mentor plus the AI's match score/reason for the requesting student. */
export type MentorMatchView = {
  mentor: MentorView;
  /** 0–100 relevance to the student's goals/stack. */
  score: number;
  reason: string;
};

/**
 * Aggregate impact stats for one mentor — powers the graphical mentor-details page.
 * All counts are derived from real bookings / doubt threads / feedback (no estimates).
 */
export type MentorStats = {
  /** Completed 1:1 or group mentorship sessions. */
  sessionsConducted: number;
  /** Confirmed sessions still upcoming (paid + subscriber). */
  upcomingSessions: number;
  /** Live broadcast sessions this mentor has run to completion. */
  liveSessions: number;
  /** Every booking ever made against this mentor, any status. */
  totalBookings: number;
  /** Distinct students who booked a session or opened a doubt thread. */
  studentsHelped: number;
  /** Number of async doubt threads opened with this mentor. */
  doubtThreads: number;
  /** Individual doubt messages students have sent this mentor. */
  doubtsAsked: number;
  /** Average post-session rating (1–5), or null if never rated. */
  avgRating: number | null;
  /** How many ratings the average is based on. */
  ratingCount: number;
  /** Count of ratings per star, index 0 = ★1 … index 4 = ★5. */
  ratingDistribution: [number, number, number, number, number];
  /** Distinct areas of expertise the mentor lists (a proxy for breadth of knowledge). */
  expertiseCount: number;
  /** Distinct technologies the mentor lists. */
  techStackCount: number;
  /** Years of professional experience, if stated. */
  yearsExperience: number | null;
};

/** A single mentor's public profile plus their aggregate impact stats. */
export type MentorDetailView = MentorView & {
  stats: MentorStats;
};

export type AvailabilitySlotView = {
  id: string;
  mentorId: string;
  startsAt: string;
  endsAt: string;
  status: SlotStatus;
  kind: SlotKind;
  access: SlotAccess;
  capacity: number;
  seatsTaken: number;
  /** Seats still available (capacity - seatsTaken), never negative. */
  seatsLeft: number;
  /** Effective price for this slot, paise/cents — 0 for casual (subscriber) slots. */
  priceCents: number;
};

export type MentorBookingView = {
  id: string;
  slotId: string;
  mentorId: string;
  mentorName: string;
  studentId: string;
  studentName: string;
  topic: string;
  note: string | null;
  status: BookingStatus;
  kind: SlotKind;
  access: SlotAccess;
  startsAt: string;
  endsAt: string;
  priceCents: number;
  /** Payment lifecycle from the linked transaction. */
  paymentStatus: PaymentStatus;
  /** Present once the payment is approved and the session is joinable. */
  joinCode: string | null;
  feedbackScore: number | null;
  feedbackComment: string | null;
  createdAt: string;
};

/** A single bookable session (open future slot) with its mentor, for the browse list. */
export type OpenSessionView = {
  slotId: string;
  mentorId: string;
  mentorName: string;
  mentorHeadline: string | null;
  mentorAvatarUrl: string | null;
  startsAt: string;
  endsAt: string;
  kind: SlotKind;
  access: SlotAccess;
  capacity: number;
  seatsLeft: number;
  /** Effective price (0 for casual/subscriber sessions). */
  priceCents: number;
};

/** What a client needs to join a booking's LiveKit call (extends the live-session token). */
export type BookingJoinResponse = JoinTokenResponse & {
  kind: SlotKind;
  /** The mentor whose video fills a group broadcast stage. */
  mentorId: string;
  mentorName: string;
};

export type MentorMessageView = {
  id: string;
  threadId: string;
  authorUserId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type MentorThreadView = {
  id: string;
  mentorId: string;
  mentorName: string;
  studentId: string;
  studentName: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
};
