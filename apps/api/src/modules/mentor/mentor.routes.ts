import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../access/access.middleware.js';
import { MentorError } from './mentor.errors.js';
import { MENTOR_MODULE, STUDENT_MODULE } from './mentor.service.js';
import {
  getAvailability,
  getMatches,
  getMentorBookings,
  getMentorDetailHandler,
  getMentorProfile,
  getMentorSlots,
  getMentorThreads,
  getMentors,
  getMyBookings,
  getSessions,
  getMyThreads,
  getThread,
  postAvailability,
  postBooking,
  postBookingJoinToken,
  postCancelBooking,
  postCancelSlot,
  postDoubt,
  postFeedback,
  postJoinByCode,
  postReplyDoubt,
  postStartSession,
  putMentorProfile,
} from './mentor.controller.js';

export const mentorRouter: Router = Router();

mentorRouter.use(requireAuth);

// Student surface — read on the student 'mentors' module + plan unlock.
const student = requirePermission(STUDENT_MODULE, 'read');
// Mentor surface — write on the 'mentor-mentors' module + plan unlock.
const mentor = requirePermission(MENTOR_MODULE, 'write');

// --- Mentor-side (must precede '/mentors/:mentorId/...' patterns; distinct prefix) ---
mentorRouter.get('/me/profile', mentor, asyncHandler(getMentorProfile));
mentorRouter.put('/me/profile', mentor, asyncHandler(putMentorProfile));
mentorRouter.get('/me/availability', mentor, asyncHandler(getAvailability));
mentorRouter.post('/me/availability', mentor, asyncHandler(postAvailability));
mentorRouter.post('/me/availability/:id/cancel', mentor, asyncHandler(postCancelSlot));
mentorRouter.post('/me/availability/:id/start', mentor, asyncHandler(postStartSession));
mentorRouter.get('/me/bookings', mentor, asyncHandler(getMentorBookings));
mentorRouter.get('/me/threads', mentor, asyncHandler(getMentorThreads));
mentorRouter.post('/me/doubts/reply', mentor, asyncHandler(postReplyDoubt));

// --- Student-side ---
mentorRouter.get('/mentors', student, asyncHandler(getMentors));
mentorRouter.get('/mentors/matches', student, asyncHandler(getMatches));
mentorRouter.get('/sessions', student, asyncHandler(getSessions));
mentorRouter.get('/mentors/:mentorId/slots', student, asyncHandler(getMentorSlots));
mentorRouter.get('/mentors/:mentorId', student, asyncHandler(getMentorDetailHandler));
mentorRouter.post('/bookings', student, asyncHandler(postBooking));
mentorRouter.get('/bookings', student, asyncHandler(getMyBookings));
mentorRouter.post('/bookings/:id/feedback', student, asyncHandler(postFeedback));
mentorRouter.post('/doubts', student, asyncHandler(postDoubt));
mentorRouter.get('/threads', student, asyncHandler(getMyThreads));

// --- Shared by both parties (auth only; party/ownership resolved in the service) ---
mentorRouter.post('/bookings/:id/cancel', asyncHandler(postCancelBooking));
mentorRouter.post('/bookings/:id/join-token', asyncHandler(postBookingJoinToken));
mentorRouter.post('/bookings/join-by-code', asyncHandler(postJoinByCode));
mentorRouter.get('/threads/:id/messages', asyncHandler(getThread));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }
      if (err instanceof MentorError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      req.log.error({ err }, 'mentor route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
