import { z } from 'zod';
import type {
  AvailabilitySlotView,
  BookingJoinResponse,
  CreateBookingInput,
  CreateSlotInput,
  MentorBookingView,
  MentorMatchView,
  MentorMessageView,
  MentorThreadView,
  MentorView,
  OpenSessionView,
  PaymentStatus,
  ReplyDoubtInput,
  SendDoubtInput,
  SlotAccess,
  SlotKind,
  SubmitFeedbackInput,
  UpsertMentorProfileInput,
  BookingStatus,
  SlotStatus,
} from '@mentra/shared';
import { generateJson, AiError } from '../../core/ai.js';
import { logger } from '../../logger.js';
import { env } from '../../env.js';
import { ensureRoom, mintToken } from '../../core/livekit.js';
import { createId } from '../../core/id.js';
import { isSubscribed, isUserAdmin } from '../access/access.service.js';
import { createNotification } from '../notification/notification.service.js';
import * as txnRepo from '../transaction/transaction.repository.js';
import { MentorError } from './mentor.errors.js';
import * as repo from './mentor.repository.js';

/**
 * Mentorship business logic. Students browse AI-matched mentors, book 1:1s against
 * mentor-published slots, and ask async doubts; mentors manage their profile,
 * availability, bookings, and reply to doubts.
 */

// Access module keys — the student-facing module and the mentor-facing surface.
// These must exist as modules (admin-managed) and be granted/unlocked, mirroring
// how 'live-sessions' / 'mentor-live-sessions' are wired.
export const STUDENT_MODULE = 'mentors';
export const MENTOR_MODULE = 'mentor-mentors';

/** AI match results are cached per student for this long before regeneration. */
const MATCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// --- View mappers ---

function toMentorView(
  userId: string,
  name: string,
  profile: repo.MentorProfileRow | undefined,
  avatar: string | null | undefined,
  openSlotCount: number,
): MentorView {
  return {
    userId,
    name,
    avatarUrl: avatar ?? null,
    headline: profile?.headline ?? null,
    bio: profile?.bio ?? null,
    expertise: repo.jsonStringArray(profile?.expertise),
    techStack: repo.jsonStringArray(profile?.techStack),
    yearsExperience: profile?.yearsExperience ?? null,
    timezone: profile?.timezone ?? 'Asia/Kolkata',
    accepting: profile ? Boolean(profile.accepting) : true,
    openSlotCount,
    sessionPriceCents: profile?.sessionPriceCents ?? 0,
    feedbackPrompt: profile?.feedbackPrompt ?? null,
  };
}

function toSlotView(row: repo.SlotRow, mentorPriceCents: number): AvailabilitySlotView {
  const seatsLeft = Math.max(0, row.capacity - row.seatsTaken);
  const access = row.access as SlotAccess;
  return {
    id: row.id,
    mentorId: row.mentorId,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status as SlotStatus,
    kind: row.kind as SlotKind,
    access,
    capacity: row.capacity,
    seatsTaken: row.seatsTaken,
    seatsLeft,
    // Casual (subscriber) slots are free at point of booking.
    priceCents: access === 'casual' ? 0 : mentorPriceCents,
  };
}

function toBookingView(
  row: repo.BookingRow,
  mentorName: string,
  studentName: string,
  paymentStatus: PaymentStatus,
): MentorBookingView {
  return {
    id: row.id,
    slotId: row.slotId,
    mentorId: row.mentorId,
    mentorName,
    studentId: row.studentId,
    studentName,
    topic: row.topic,
    note: row.note,
    status: row.status as BookingStatus,
    kind: row.slotKind as SlotKind,
    access: row.slotAccess as SlotAccess,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    priceCents: row.priceCents,
    paymentStatus,
    joinCode: row.joinCode,
    feedbackScore: row.feedbackScore,
    feedbackComment: row.feedbackComment,
    createdAt: row.createdAt.toISOString(),
  };
}

function toPaymentStatus(raw: string | undefined): PaymentStatus {
  if (raw === 'pending' || raw === 'approved' || raw === 'rejected' || raw === 'refunded') return raw;
  return null;
}

function toMessageView(row: repo.MessageRow, authorName: string): MentorMessageView {
  return {
    id: row.id,
    threadId: row.threadId,
    authorUserId: row.authorUserId,
    authorName,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

// --- Directory (students) ---

/** All active mentors with their profiles + open-slot counts. */
export async function listMentors(): Promise<MentorView[]> {
  const users = await repo.listMentorUserIds();
  if (users.length === 0) return [];
  const ids = users.map((u) => u.id);
  const [profiles, avatars, slotCounts] = await Promise.all([
    repo.findProfiles(ids),
    repo.findAvatars(ids),
    repo.countOpenFutureSlots(ids),
  ]);
  return users.map((u) =>
    toMentorView(u.id, u.name, profiles.get(u.id), avatars.get(u.id), slotCounts.get(u.id) ?? 0),
  );
}

// --- AI matching (students) ---

const aiMatchSchema = z.object({
  matches: z
    .array(
      z.object({
        mentorId: z.string(),
        score: z.number().min(0).max(100),
        reason: z.string().max(400),
      }),
    )
    .max(20),
});
type AiMatch = z.infer<typeof aiMatchSchema>['matches'][number];

/**
 * AI-ranked mentors for a student. Result is cached in the DB (per project AI rules:
 * never call speculatively, validate JSON, cache). Falls back to deterministic
 * overlap ranking if the model is unavailable so the page always renders.
 */
export async function matchMentors(studentId: string): Promise<MentorMatchView[]> {
  const mentors = await listMentors();
  if (mentors.length === 0) return [];
  const byId = new Map(mentors.map((m) => [m.userId, m]));

  // 1. Serve fresh cache if the cached mentor set still exists.
  const cached = await repo.findMatchCache(studentId);
  if (cached && Date.now() - new Date(cached.generatedAt).getTime() < MATCH_CACHE_TTL_MS) {
    const ranked = parseCachedMatches(cached.result, byId);
    if (ranked.length > 0) return ranked;
  }

  // 2. Generate via the model, validated + cached. Fall back on any AI failure.
  const signals = await repo.findStudentSignals(studentId);
  try {
    const result = await generateJson({
      schema: aiMatchSchema,
      temperature: 0.3,
      system:
        'You are a mentor-matching engine for a career-prep platform. Given a student profile and a ' +
        'list of candidate mentors, rank the mentors by how well they fit the student. Respond with ' +
        'JSON only: {"matches":[{"mentorId","score","reason"}]}. score is 0-100. reason is one short ' +
        'sentence addressed to the student. Only use mentorId values from the candidates. Rank ALL candidates.',
      user: JSON.stringify({
        student: {
          targetRoles: signals?.targetRoles ?? [],
          techStack: signals?.techStack ?? [],
          goal: signals?.goal ?? null,
          bio: signals?.bio ?? null,
        },
        mentors: mentors.map((m) => ({
          mentorId: m.userId,
          name: m.name,
          headline: m.headline,
          expertise: m.expertise,
          techStack: m.techStack,
          yearsExperience: m.yearsExperience,
        })),
      }),
    });
    await repo.upsertMatchCache(studentId, result.matches);
    const ranked = mapMatches(result.matches, byId);
    if (ranked.length > 0) return ranked;
  } catch (err) {
    if (err instanceof AiError) {
      logger.warn({ err: err.code, studentId }, 'mentor.match.ai_fallback');
    } else {
      throw err;
    }
  }

  // 3. Deterministic fallback.
  return fallbackRank(mentors, signals);
}

function parseCachedMatches(raw: unknown, byId: Map<string, MentorView>): MentorMatchView[] {
  const parsed = z.array(z.object({ mentorId: z.string(), score: z.number(), reason: z.string() })).safeParse(raw);
  if (!parsed.success) return [];
  return mapMatches(parsed.data, byId);
}

function mapMatches(matches: AiMatch[], byId: Map<string, MentorView>): MentorMatchView[] {
  const seen = new Set<string>();
  const out: MentorMatchView[] = [];
  for (const m of matches) {
    const mentor = byId.get(m.mentorId);
    if (!mentor || seen.has(m.mentorId)) continue;
    seen.add(m.mentorId);
    out.push({ mentor, score: Math.round(m.score), reason: m.reason });
  }
  // Append any mentors the model omitted, lowest priority.
  for (const mentor of byId.values()) {
    if (!seen.has(mentor.userId)) out.push({ mentor, score: 0, reason: 'Also available to mentor you.' });
  }
  return out.sort((a, b) => b.score - a.score);
}

function fallbackRank(
  mentors: MentorView[],
  signals: { techStack: string[]; targetRoles: string[] } | null,
): MentorMatchView[] {
  const want = new Set(
    [...(signals?.techStack ?? []), ...(signals?.targetRoles ?? [])].map((s) => s.toLowerCase()),
  );
  return mentors
    .map((mentor) => {
      const have = [...mentor.expertise, ...mentor.techStack].map((s) => s.toLowerCase());
      const overlap = have.filter((s) => want.has(s));
      const score = want.size === 0 ? 50 : Math.min(100, Math.round((overlap.length / want.size) * 100));
      const reason =
        overlap.length > 0
          ? `Shares your focus on ${[...new Set(overlap)].slice(0, 3).join(', ')}.`
          : 'Available to help with your goals.';
      return { mentor, score, reason };
    })
    .sort((a, b) => b.score - a.score);
}

// --- Slots (students view; mentors manage) ---

/** Open, future bookable slots for one mentor (student-facing). */
export async function listOpenSlots(mentorId: string): Promise<AvailabilitySlotView[]> {
  const mentor = await repo.findUserById(mentorId);
  if (!mentor || mentor.role !== 'mentor') throw new MentorError('MENTOR_NOT_FOUND', 'Mentor not found', 404);
  const profile = await repo.findProfile(mentorId);
  const price = profile?.sessionPriceCents ?? 0;
  const rows = await repo.listSlotsByMentor(mentorId, { futureOnly: true, openOnly: true });
  return rows.map((r) => toSlotView(r, price));
}

/** Every bookable session (open future slot) across all mentors, for the browse list. */
export async function listOpenSessions(): Promise<OpenSessionView[]> {
  const rows = await repo.listOpenSessions();
  return rows.map((r) => {
    const access = r.access as SlotAccess;
    return {
      slotId: r.id,
      mentorId: r.mentorId,
      mentorName: r.mentorName,
      mentorHeadline: r.headline ?? null,
      mentorAvatarUrl: r.avatarUrl ?? null,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
      kind: r.kind as SlotKind,
      access,
      capacity: r.capacity,
      seatsLeft: Math.max(0, r.capacity - r.seatsTaken),
      priceCents: access === 'casual' ? 0 : r.sessionPriceCents ?? 0,
    };
  });
}

export async function listMyAvailability(mentorId: string): Promise<AvailabilitySlotView[]> {
  const profile = await repo.findProfile(mentorId);
  const price = profile?.sessionPriceCents ?? 0;
  const rows = await repo.listSlotsByMentor(mentorId, { futureOnly: true });
  return rows.map((r) => toSlotView(r, price));
}

export async function addSlot(mentorId: string, input: CreateSlotInput): Promise<AvailabilitySlotView> {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (endsAt <= startsAt) throw new MentorError('INVALID_SLOT', 'Slot end must be after start', 400);
  if (startsAt.getTime() < Date.now()) throw new MentorError('INVALID_SLOT', 'Slot must be in the future', 400);
  // 1:1 slots always hold exactly one seat regardless of submitted capacity.
  const capacity = input.kind === 'group' ? Math.max(1, input.capacity) : 1;
  const row = await repo.createSlot({ mentorId, startsAt, endsAt, kind: input.kind, access: input.access, capacity });
  const profile = await repo.findProfile(mentorId);
  return toSlotView(row, profile?.sessionPriceCents ?? 0);
}

export async function cancelSlot(mentorId: string, slotId: string): Promise<void> {
  const slot = await repo.findSlotById(slotId);
  if (!slot) throw new MentorError('SLOT_NOT_FOUND', 'Slot not found', 404);
  if (slot.mentorId !== mentorId && !(await isUserAdmin(mentorId)))
    throw new MentorError('NOT_OWNER', 'You do not own this slot', 403);
  if (slot.seatsTaken > 0) throw new MentorError('SLOT_BOOKED', 'Cancel the bookings first', 409);
  await repo.setSlotStatus(slotId, 'cancelled');
}

// --- Bookings (paid: checkout → pending payment → accountant approval) ---

export async function bookSlot(studentId: string, input: CreateBookingInput): Promise<MentorBookingView> {
  const slot = await repo.findSlotById(input.slotId);
  if (!slot) throw new MentorError('SLOT_NOT_FOUND', 'Slot not found', 404);
  if (slot.endsAt.getTime() < Date.now()) throw new MentorError('SLOT_PAST', 'That slot is in the past', 409);
  if (slot.mentorId === studentId) throw new MentorError('SELF_BOOK', 'You cannot book your own slot', 400);

  // Idempotent: if the student already has an active booking for this slot, return it
  // (so "Join" on a casual session can be clicked repeatedly without double-booking).
  const existing = await repo.findBookingBySlotAndStudent(slot.id, studentId);
  if (existing && ['pending_payment', 'confirmed', 'completed'].includes(existing.status)) {
    const names = await repo.findUserNames([slot.mentorId, studentId]);
    const pay = await txnRepo.statusByBookingIds([existing.id]);
    return toBookingView(
      existing,
      names.get(slot.mentorId) ?? 'Mentor',
      names.get(studentId) ?? 'Student',
      toPaymentStatus(pay.get(existing.id)),
    );
  }

  const isCasual = slot.access === 'casual';
  // Casual (subscriber-only) slots require an active Mentra subscription and are free.
  if (isCasual && !(await isSubscribed(studentId)) && !(await isUserAdmin(studentId))) {
    throw new MentorError('SUB_REQUIRED', 'This session is included with a subscription — subscribe to book it', 402);
  }
  const profile = await repo.findProfile(slot.mentorId);
  const priceCents = isCasual ? 0 : profile?.sessionPriceCents ?? 0;

  // Atomically claim a seat (1:1 = the only seat; group = one of capacity).
  const won = await repo.claimSeat(input.slotId);
  if (!won) throw new MentorError('SLOT_TAKEN', 'That slot is full — pick another', 409);

  try {
    const booking = await repo.createBooking({
      slotId: slot.id,
      mentorId: slot.mentorId,
      studentId,
      topic: input.topic,
      note: input.note ?? null,
      priceCents,
      status: 'pending_payment',
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    });
    const txn = await txnRepo.createTransaction({ bookingId: booking.id, studentId, mentorId: slot.mentorId, amountCents: priceCents });
    const names = await repo.findUserNames([slot.mentorId, studentId]);
    const studentName = names.get(studentId) ?? 'A student';

    if (isCasual) {
      // Subscription-covered: auto-approve the ₹0 transaction and confirm immediately.
      await txnRepo.setStatus(txn.id, 'approved', 'system', 'Subscription-covered');
      await confirmBookingPaid(booking.id);
      await createNotification({
        userId: slot.mentorId,
        type: 'mentor.booking_new',
        title: `${studentName} booked your session`,
        body: input.topic,
        link: '/mentor-mentors',
        moduleKey: MENTOR_MODULE,
      });
      const confirmed = await repo.findBookingById(booking.id);
      return toBookingView(confirmed!, names.get(slot.mentorId) ?? 'Mentor', studentName, 'approved');
    }

    // Paid: leave the transaction pending for the accountant to review.
    await createNotification({
      userId: slot.mentorId,
      type: 'mentor.booking_new',
      title: `New booking from ${studentName}`,
      body: `${input.topic} · awaiting payment approval`,
      link: '/mentor-mentors',
      moduleKey: MENTOR_MODULE,
    });
    return toBookingView(booking, names.get(slot.mentorId) ?? 'Mentor', studentName, 'pending');
  } catch (err) {
    // Release the seat if the booking/transaction failed to persist.
    await repo.releaseSeat(input.slotId).catch(() => {});
    throw err;
  }
}

export async function listMyBookings(studentId: string): Promise<MentorBookingView[]> {
  const rows = await repo.listBookingsByStudent(studentId);
  return hydrateBookings(rows);
}

export async function listMentorBookings(mentorId: string): Promise<MentorBookingView[]> {
  const rows = await repo.listBookingsByMentor(mentorId);
  return hydrateBookings(rows);
}

async function hydrateBookings(rows: repo.BookingRow[]): Promise<MentorBookingView[]> {
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.flatMap((r) => [r.mentorId, r.studentId]))];
  const [names, payments] = await Promise.all([
    repo.findUserNames(ids),
    txnRepo.statusByBookingIds(rows.map((r) => r.id)),
  ]);
  return rows.map((r) =>
    toBookingView(
      r,
      names.get(r.mentorId) ?? 'Mentor',
      names.get(r.studentId) ?? 'Student',
      toPaymentStatus(payments.get(r.id)),
    ),
  );
}

export async function cancelBooking(userId: string, bookingId: string): Promise<void> {
  const booking = await repo.findBookingById(bookingId);
  if (!booking) throw new MentorError('BOOKING_NOT_FOUND', 'Booking not found', 404);
  const isParty = booking.studentId === userId || booking.mentorId === userId;
  if (!isParty && !(await isUserAdmin(userId)))
    throw new MentorError('NOT_PARTY', 'You are not part of this booking', 403);
  if (booking.status !== 'confirmed' && booking.status !== 'pending_payment') return;
  await repo.setBookingStatus(bookingId, 'cancelled');
  await repo.releaseSeat(booking.slotId).catch(() => {});
}

// --- Payment-driven booking transitions (called by the transaction module) ---

/** Confirm a paid booking: generate a join code + room. Idempotent. */
export async function confirmBookingPaid(bookingId: string): Promise<void> {
  const booking = await repo.findBookingById(bookingId);
  if (!booking) throw new MentorError('BOOKING_NOT_FOUND', 'Booking not found', 404);
  if (booking.status === 'confirmed') return;
  await repo.setSlotRoom(booking.slotId, roomFor(booking.slotId)).catch(() => {});
  const code = booking.joinCode ?? createId().slice(0, 8).toUpperCase();
  await repo.setBookingStatus(bookingId, 'confirmed');
  if (!booking.joinCode) await repo.setBookingJoinCode(bookingId, code);
  const names = await repo.findUserNames([booking.mentorId]);
  await createNotification({
    userId: booking.studentId,
    type: 'mentor.booking_confirmed',
    title: 'Your session is confirmed',
    body: `with ${names.get(booking.mentorId) ?? 'your mentor'} · join code ${code}`,
    link: '/mentors',
    moduleKey: STUDENT_MODULE,
  });
}

/** Reject a paid booking: free the seat. */
export async function rejectBooking(bookingId: string): Promise<void> {
  const booking = await repo.findBookingById(bookingId);
  if (!booking) throw new MentorError('BOOKING_NOT_FOUND', 'Booking not found', 404);
  if (booking.status === 'rejected') return;
  await repo.setBookingStatus(bookingId, 'rejected');
  await repo.releaseSeat(booking.slotId).catch(() => {});
}

// --- Joining the call ---

const roomFor = (slotId: string): string => `ms_${slotId}`;

async function joinForBooking(userId: string, booking: repo.BookingRow): Promise<BookingJoinResponse> {
  const isParty = booking.studentId === userId || booking.mentorId === userId;
  if (!isParty && !(await isUserAdmin(userId)))
    throw new MentorError('NOT_PARTY', 'You are not part of this session', 403);
  if (booking.status !== 'confirmed')
    throw new MentorError('NOT_JOINABLE', 'This session is not confirmed yet', 409);

  const room = roomFor(booking.slotId);
  await ensureRoom(room);
  const isMentor = booking.mentorId === userId;
  // 1:1 → both publish; group → only the mentor publishes (students watch).
  const canPublish = booking.slotKind === 'one_to_one' ? true : isMentor;
  const names = await repo.findUserNames([userId, booking.mentorId]);
  const token = await mintToken({ room, identity: userId, name: names.get(userId) ?? 'Participant', canPublish });
  return {
    token,
    wsUrl: env.LIVEKIT_WS_URL,
    room,
    canPublish,
    kind: booking.slotKind as SlotKind,
    mentorId: booking.mentorId,
    mentorName: names.get(booking.mentorId) ?? 'Mentor',
  };
}

export async function getBookingJoinToken(userId: string, bookingId: string): Promise<BookingJoinResponse> {
  const booking = await repo.findBookingById(bookingId);
  if (!booking) throw new MentorError('BOOKING_NOT_FOUND', 'Booking not found', 404);
  return joinForBooking(userId, booking);
}

export async function joinByCode(userId: string, code: string): Promise<BookingJoinResponse> {
  const booking = await repo.findBookingByCode(code);
  if (!booking) throw new MentorError('CODE_NOT_FOUND', 'No session matches that code', 404);
  return joinForBooking(userId, booking);
}

/** Mentor starts/joins a slot's session room (always a publisher). */
export async function startSession(mentorId: string, slotId: string): Promise<BookingJoinResponse> {
  const slot = await repo.findSlotById(slotId);
  if (!slot) throw new MentorError('SLOT_NOT_FOUND', 'Slot not found', 404);
  if (slot.mentorId !== mentorId && !(await isUserAdmin(mentorId)))
    throw new MentorError('NOT_OWNER', 'You do not own this slot', 403);
  const room = roomFor(slotId);
  await ensureRoom(room);
  await repo.setSlotRoom(slotId, room).catch(() => {});
  const me = await repo.findUserById(mentorId);
  const token = await mintToken({ room, identity: mentorId, name: me?.name ?? 'Mentor', canPublish: true });
  return {
    token,
    wsUrl: env.LIVEKIT_WS_URL,
    room,
    canPublish: true,
    kind: slot.kind as SlotKind,
    mentorId,
    mentorName: me?.name ?? 'Mentor',
  };
}

// --- Feedback ---

export async function submitFeedback(studentId: string, input: SubmitFeedbackInput): Promise<MentorBookingView> {
  const booking = await repo.findBookingById(input.bookingId);
  if (!booking) throw new MentorError('BOOKING_NOT_FOUND', 'Booking not found', 404);
  if (booking.studentId !== studentId) throw new MentorError('NOT_PARTY', 'Only the attendee can leave feedback', 403);
  if (booking.status !== 'confirmed' && booking.status !== 'completed')
    throw new MentorError('NOT_FINISHED', 'Feedback is available after the session is confirmed', 409);
  await repo.setBookingFeedback(input.bookingId, input.score, input.comment ?? null);
  const updated = await repo.findBookingById(input.bookingId);
  const names = await repo.findUserNames([booking.mentorId, booking.studentId]);
  await createNotification({
    userId: booking.mentorId,
    type: 'mentor.feedback',
    title: `${names.get(booking.studentId) ?? 'A student'} left feedback (${input.score}★)`,
    body: input.comment ? input.comment.slice(0, 120) : null,
    link: '/mentor-mentors',
    moduleKey: MENTOR_MODULE,
  });
  const payment = await txnRepo.statusByBookingIds([input.bookingId]);
  return toBookingView(
    updated!,
    names.get(booking.mentorId) ?? 'Mentor',
    names.get(booking.studentId) ?? 'Student',
    toPaymentStatus(payment.get(input.bookingId)),
  );
}

// --- Mentor profile (mentor-side) ---

export async function getMyProfile(mentorId: string): Promise<MentorView> {
  const user = await repo.findUserById(mentorId);
  if (!user) throw new MentorError('MENTOR_NOT_FOUND', 'User not found', 404);
  const [profile, avatars, slotCounts] = await Promise.all([
    repo.findProfile(mentorId),
    repo.findAvatars([mentorId]),
    repo.countOpenFutureSlots([mentorId]),
  ]);
  return toMentorView(
    mentorId,
    user.name,
    profile ?? undefined,
    avatars.get(mentorId),
    slotCounts.get(mentorId) ?? 0,
  );
}

export async function updateMyProfile(
  mentorId: string,
  input: UpsertMentorProfileInput,
): Promise<MentorView> {
  await repo.upsertProfile(mentorId, {
    headline: input.headline,
    bio: input.bio,
    expertise: input.expertise,
    techStack: input.techStack,
    yearsExperience: input.yearsExperience === undefined ? undefined : input.yearsExperience,
    timezone: input.timezone,
    accepting: input.accepting,
    sessionPriceCents: input.sessionPriceCents,
    feedbackPrompt: input.feedbackPrompt,
  });
  return getMyProfile(mentorId);
}

// --- Async doubts (threads + messages) ---

/** Student opens/continues a doubt thread with a mentor and posts a message. */
export async function sendDoubt(studentId: string, input: SendDoubtInput): Promise<MentorMessageView> {
  const mentor = await repo.findUserById(input.mentorId);
  if (!mentor || mentor.role !== 'mentor') throw new MentorError('MENTOR_NOT_FOUND', 'Mentor not found', 404);
  if (input.mentorId === studentId) throw new MentorError('SELF_THREAD', 'You cannot message yourself', 400);
  const thread = await repo.getOrCreateThread(input.mentorId, studentId);
  const row = await repo.insertMessage({ threadId: thread.id, authorUserId: studentId, body: input.body });
  const names = await repo.findUserNames([studentId]);
  await createNotification({
    userId: input.mentorId,
    type: 'mentor.doubt',
    title: `${names.get(studentId) ?? 'A student'} asked a doubt`,
    body: input.body.slice(0, 120),
    link: '/mentor-mentors',
    moduleKey: MENTOR_MODULE,
  });
  return toMessageView(row, names.get(studentId) ?? 'You');
}

/** Mentor replies within a thread they own. */
export async function replyDoubt(mentorId: string, input: ReplyDoubtInput): Promise<MentorMessageView> {
  const thread = await repo.findThreadById(input.threadId);
  if (!thread) throw new MentorError('THREAD_NOT_FOUND', 'Thread not found', 404);
  if (thread.mentorId !== mentorId && !(await isUserAdmin(mentorId)))
    throw new MentorError('NOT_PARTY', 'You are not part of this thread', 403);
  const row = await repo.insertMessage({ threadId: thread.id, authorUserId: mentorId, body: input.body });
  const names = await repo.findUserNames([mentorId]);
  await createNotification({
    userId: thread.studentId,
    type: 'mentor.doubt_reply',
    title: `${names.get(mentorId) ?? 'Your mentor'} replied to your doubt`,
    body: input.body.slice(0, 120),
    link: '/mentors',
    moduleKey: STUDENT_MODULE,
  });
  return toMessageView(row, names.get(mentorId) ?? 'Mentor');
}

export async function listMyThreadsAsStudent(studentId: string): Promise<MentorThreadView[]> {
  return hydrateThreads(await repo.listThreadsByStudent(studentId));
}

export async function listMyThreadsAsMentor(mentorId: string): Promise<MentorThreadView[]> {
  return hydrateThreads(await repo.listThreadsByMentor(mentorId));
}

async function hydrateThreads(rows: repo.ThreadRow[]): Promise<MentorThreadView[]> {
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.flatMap((r) => [r.mentorId, r.studentId]))];
  const [names, previews] = await Promise.all([
    repo.findUserNames(ids),
    repo.latestMessagePreviews(rows.map((r) => r.id)),
  ]);
  return rows.map((r) => ({
    id: r.id,
    mentorId: r.mentorId,
    mentorName: names.get(r.mentorId) ?? 'Mentor',
    studentId: r.studentId,
    studentName: names.get(r.studentId) ?? 'Student',
    lastMessageAt: r.lastMessageAt ? r.lastMessageAt.toISOString() : null,
    lastMessagePreview: previews.get(r.id) ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Messages in a thread the requester is a party to. */
export async function getThreadMessages(userId: string, threadId: string): Promise<MentorMessageView[]> {
  const thread = await repo.findThreadById(threadId);
  if (!thread) throw new MentorError('THREAD_NOT_FOUND', 'Thread not found', 404);
  const isParty = thread.studentId === userId || thread.mentorId === userId;
  if (!isParty && !(await isUserAdmin(userId)))
    throw new MentorError('NOT_PARTY', 'You are not part of this thread', 403);
  const rows = await repo.listMessages(threadId);
  const names = await repo.findUserNames([thread.mentorId, thread.studentId]);
  return rows.map((r) =>
    toMessageView(
      r,
      names.get(r.authorUserId) ?? (r.authorUserId === thread.mentorId ? 'Mentor' : 'Student'),
    ),
  );
}
