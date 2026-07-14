import type { Request, Response } from 'express';
import {
  createBookingSchema,
  createSlotSchema,
  joinByCodeSchema,
  replyDoubtSchema,
  sendDoubtSchema,
  submitFeedbackSchema,
  upsertMentorProfileSchema,
} from '@mentra/shared';
import {
  addSlot,
  bookSlot,
  cancelBooking,
  cancelSlot,
  getBookingJoinToken,
  getMentorDetail,
  getMyProfile,
  getThreadMessages,
  joinByCode,
  listMentorBookings,
  listMentors,
  listMyAvailability,
  listOpenSessions,
  listMyBookings,
  listMyThreadsAsMentor,
  listMyThreadsAsStudent,
  listOpenSlots,
  matchMentors,
  replyDoubt,
  sendDoubt,
  startSession,
  submitFeedback,
  updateMyProfile,
} from './mentor.service.js';

const uid = (req: Request): string => req.auth!.sub;
const param = (req: Request, name: string): string => {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

// --- Student surface ---

export async function getMentors(req: Request, res: Response): Promise<void> {
  res.json({ data: await listMentors() });
}

export async function getMatches(req: Request, res: Response): Promise<void> {
  res.json({ data: await matchMentors(uid(req)) });
}

export async function getMentorSlots(req: Request, res: Response): Promise<void> {
  res.json({ data: await listOpenSlots(param(req, 'mentorId')) });
}

export async function getMentorDetailHandler(req: Request, res: Response): Promise<void> {
  res.json({ data: await getMentorDetail(param(req, 'mentorId')) });
}

export async function getSessions(req: Request, res: Response): Promise<void> {
  res.json({ data: await listOpenSessions() });
}

export async function postBooking(req: Request, res: Response): Promise<void> {
  const input = createBookingSchema.parse(req.body ?? {});
  res.json({ data: await bookSlot(uid(req), input) });
}

export async function getMyBookings(req: Request, res: Response): Promise<void> {
  res.json({ data: await listMyBookings(uid(req)) });
}

export async function postDoubt(req: Request, res: Response): Promise<void> {
  const input = sendDoubtSchema.parse(req.body ?? {});
  res.json({ data: await sendDoubt(uid(req), input) });
}

export async function getMyThreads(req: Request, res: Response): Promise<void> {
  res.json({ data: await listMyThreadsAsStudent(uid(req)) });
}

export async function postFeedback(req: Request, res: Response): Promise<void> {
  const input = submitFeedbackSchema.parse(req.body ?? {});
  res.json({ data: await submitFeedback(uid(req), input) });
}

// --- Shared (party check in service) ---

export async function postCancelBooking(req: Request, res: Response): Promise<void> {
  await cancelBooking(uid(req), param(req, 'id'));
  res.json({ data: { ok: true } });
}

export async function postBookingJoinToken(req: Request, res: Response): Promise<void> {
  res.json({ data: await getBookingJoinToken(uid(req), param(req, 'id')) });
}

export async function postJoinByCode(req: Request, res: Response): Promise<void> {
  const input = joinByCodeSchema.parse(req.body ?? {});
  res.json({ data: await joinByCode(uid(req), input.code) });
}

export async function getThread(req: Request, res: Response): Promise<void> {
  res.json({ data: await getThreadMessages(uid(req), param(req, 'id')) });
}

// --- Mentor: start a session room ---

export async function postStartSession(req: Request, res: Response): Promise<void> {
  res.json({ data: await startSession(uid(req), param(req, 'id')) });
}

// --- Mentor surface ---

export async function getMentorProfile(req: Request, res: Response): Promise<void> {
  res.json({ data: await getMyProfile(uid(req)) });
}

export async function putMentorProfile(req: Request, res: Response): Promise<void> {
  const input = upsertMentorProfileSchema.parse(req.body ?? {});
  res.json({ data: await updateMyProfile(uid(req), input) });
}

export async function getAvailability(req: Request, res: Response): Promise<void> {
  res.json({ data: await listMyAvailability(uid(req)) });
}

export async function postAvailability(req: Request, res: Response): Promise<void> {
  const input = createSlotSchema.parse(req.body ?? {});
  res.json({ data: await addSlot(uid(req), input) });
}

export async function postCancelSlot(req: Request, res: Response): Promise<void> {
  await cancelSlot(uid(req), param(req, 'id'));
  res.json({ data: { ok: true } });
}

export async function getMentorBookings(req: Request, res: Response): Promise<void> {
  res.json({ data: await listMentorBookings(uid(req)) });
}

export async function getMentorThreads(req: Request, res: Response): Promise<void> {
  res.json({ data: await listMyThreadsAsMentor(uid(req)) });
}

export async function postReplyDoubt(req: Request, res: Response): Promise<void> {
  const input = replyDoubtSchema.parse(req.body ?? {});
  res.json({ data: await replyDoubt(uid(req), input) });
}
