import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AvailabilitySlotView,
  BookingJoinResponse,
  CreateBookingInput,
  CreateSlotInput,
  MentorBookingView,
  MentorDetailView,
  MentorMatchView,
  MentorMessageView,
  MentorThreadView,
  MentorView,
  OpenSessionView,
  ReplyDoubtInput,
  SendDoubtInput,
  SubmitFeedbackInput,
  UpsertMentorProfileInput,
} from '@mentra/shared';
import { apiFetch } from './api.js';

/** ₹ display for an integer paise/cents amount. */
export const formatPrice = (cents: number): string => (cents <= 0 ? 'Free' : `₹${Math.round(cents / 100)}`);

const base = '/api/v1/mentor';

/** Stable hue derived from a mentor id so each mentor gets a consistent accent. */
export function hueOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

export const avatarBg = (hue: number) =>
  `linear-gradient(135deg, hsl(${hue} 65% 45%), hsl(${(hue + 40) % 360} 60% 38%))`;

/** Friendly date/time label for slots and bookings. */
export function formatSlot(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

// --- Student: directory, matching, slots ---

export function useMentors() {
  return useQuery({
    queryKey: ['mentor', 'directory'],
    queryFn: () => apiFetch<MentorView[]>(`${base}/mentors`),
  });
}

/** One mentor's profile + aggregate impact stats — for the mentor details page. */
export function useMentorDetail(mentorId: string | undefined) {
  return useQuery({
    queryKey: ['mentor', 'detail', mentorId],
    queryFn: () => apiFetch<MentorDetailView>(`${base}/mentors/${mentorId}`),
    enabled: !!mentorId,
  });
}

/** The Find-a-mentor list: AI-matched mentors (with score + reason) for the logged-in student. */
export function useMentorMatches() {
  return useQuery({
    queryKey: ['mentor', 'matches'],
    queryFn: () => apiFetch<MentorMatchView[]>(`${base}/mentors/matches`),
    staleTime: 5 * 60_000,
  });
}

/** All bookable sessions (open slots) across mentors — the browse list. */
export function useOpenSessions() {
  return useQuery({
    queryKey: ['mentor', 'sessions'],
    queryFn: () => apiFetch<OpenSessionView[]>(`${base}/sessions`),
  });
}

export function useMentorSlots(mentorId: string | null) {
  return useQuery({
    queryKey: ['mentor', 'slots', mentorId],
    queryFn: () => apiFetch<AvailabilitySlotView[]>(`${base}/mentors/${mentorId}/slots`),
    enabled: !!mentorId,
  });
}

// --- Student: bookings ---

export function useMyBookings() {
  return useQuery({
    queryKey: ['mentor', 'my-bookings'],
    queryFn: () => apiFetch<MentorBookingView[]>(`${base}/bookings`),
  });
}

export function useBookSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookingInput) =>
      apiFetch<MentorBookingView>(`${base}/bookings`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (booking) => {
      qc.invalidateQueries({ queryKey: ['mentor', 'my-bookings'] });
      qc.invalidateQueries({ queryKey: ['mentor', 'slots', booking.mentorId] });
      qc.invalidateQueries({ queryKey: ['mentor', 'sessions'] });
      qc.invalidateQueries({ queryKey: ['mentor', 'directory'] });
      qc.invalidateQueries({ queryKey: ['mentor', 'matches'] });
    },
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`${base}/bookings/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mentor', 'my-bookings'] });
      qc.invalidateQueries({ queryKey: ['mentor', 'mentor-bookings'] });
      qc.invalidateQueries({ queryKey: ['mentor', 'slots'] });
    },
  });
}

// --- Joining the call + feedback ---

export function useBookingJoinToken() {
  return useMutation({
    mutationFn: (bookingId: string) =>
      apiFetch<BookingJoinResponse>(`${base}/bookings/${bookingId}/join-token`, { method: 'POST' }),
  });
}

export function useJoinByCode() {
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<BookingJoinResponse>(`${base}/bookings/join-by-code`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
  });
}

/** Mentor starts/joins a slot's session room (returns a publisher token). */
export function useStartSession() {
  return useMutation({
    mutationFn: (slotId: string) =>
      apiFetch<BookingJoinResponse>(`${base}/me/availability/${slotId}/start`, { method: 'POST' }),
  });
}

export function useSubmitFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitFeedbackInput) =>
      apiFetch<MentorBookingView>(`${base}/bookings/${input.bookingId}/feedback`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mentor', 'my-bookings'] });
      qc.invalidateQueries({ queryKey: ['mentor', 'mentor-bookings'] });
    },
  });
}

// --- Async doubts (shared) ---

export function useMyThreads() {
  return useQuery({
    queryKey: ['mentor', 'threads', 'student'],
    queryFn: () => apiFetch<MentorThreadView[]>(`${base}/threads`),
  });
}

export function useMentorThreads() {
  return useQuery({
    queryKey: ['mentor', 'threads', 'mentor'],
    queryFn: () => apiFetch<MentorThreadView[]>(`${base}/me/threads`),
  });
}

export function useThreadMessages(threadId: string | null) {
  return useQuery({
    queryKey: ['mentor', 'thread-messages', threadId],
    queryFn: () => apiFetch<MentorMessageView[]>(`${base}/threads/${threadId}/messages`),
    enabled: !!threadId,
    refetchInterval: 10_000,
  });
}

export function useSendDoubt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SendDoubtInput) =>
      apiFetch<MentorMessageView>(`${base}/doubts`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (msg) => {
      qc.invalidateQueries({ queryKey: ['mentor', 'threads', 'student'] });
      qc.invalidateQueries({ queryKey: ['mentor', 'thread-messages', msg.threadId] });
    },
  });
}

export function useReplyDoubt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReplyDoubtInput) =>
      apiFetch<MentorMessageView>(`${base}/me/doubts/reply`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (msg) => {
      qc.invalidateQueries({ queryKey: ['mentor', 'threads', 'mentor'] });
      qc.invalidateQueries({ queryKey: ['mentor', 'thread-messages', msg.threadId] });
    },
  });
}

// --- Mentor: profile + availability + bookings ---

export function useMyMentorProfile() {
  return useQuery({
    queryKey: ['mentor', 'my-profile'],
    queryFn: () => apiFetch<MentorView>(`${base}/me/profile`),
  });
}

export function useUpdateMentorProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertMentorProfileInput) =>
      apiFetch<MentorView>(`${base}/me/profile`, { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mentor', 'my-profile'] }),
  });
}

export function useMyAvailability() {
  return useQuery({
    queryKey: ['mentor', 'availability'],
    queryFn: () => apiFetch<AvailabilitySlotView[]>(`${base}/me/availability`),
  });
}

export function useAddSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSlotInput) =>
      apiFetch<AvailabilitySlotView>(`${base}/me/availability`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mentor', 'availability'] });
      qc.invalidateQueries({ queryKey: ['mentor', 'my-profile'] });
    },
  });
}

export function useCancelSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`${base}/me/availability/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mentor', 'availability'] });
      qc.invalidateQueries({ queryKey: ['mentor', 'my-profile'] });
    },
  });
}

export function useMentorBookings() {
  return useQuery({
    queryKey: ['mentor', 'mentor-bookings'],
    queryFn: () => apiFetch<MentorBookingView[]>(`${base}/me/bookings`),
  });
}
