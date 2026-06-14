import type {
  ChatMessageView,
  CreateLiveSessionInput,
  JoinTokenResponse,
  LiveSessionStatus,
  LiveSessionView,
  SessionSummary,
  UpdateLiveSessionInput,
} from '@mentra/shared';
import type { WebhookEvent } from 'livekit-server-sdk';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { emit } from '../../core/events.js';
import { ensureRoom, endRoom, mintToken } from '../../core/livekit.js';
import { tryGetIo } from '../../core/realtime.js';
import { getEffectivePermission, isUserAdmin } from '../access/access.service.js';
import { LiveSessionError } from './live-session.errors.js';
import * as repo from './live-session.repository.js';

/** Module keys gating the two surfaces (match the frontend AppLayout guard). */
export const STUDENT_MODULE = 'live-sessions';
export const MENTOR_MODULE = 'mentor-live-sessions';

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function toView(row: repo.LiveSessionRow, mentorName: string, requesterId: string): LiveSessionView {
  return {
    id: row.id,
    mentorId: row.mentorId,
    mentorName,
    title: row.title,
    topic: row.topic,
    status: row.status as LiveSessionStatus,
    scheduledFor: iso(row.scheduledFor),
    startedAt: iso(row.startedAt),
    endedAt: iso(row.endedAt),
    currentViewers: row.currentViewers,
    peakViewers: row.peakViewers,
    isOwner: row.mentorId === requesterId,
    createdAt: row.createdAt.toISOString(),
  };
}

async function toViews(rows: repo.LiveSessionRow[], requesterId: string): Promise<LiveSessionView[]> {
  const names = await repo.findUserNames([...new Set(rows.map((r) => r.mentorId))]);
  return rows.map((r) => toView(r, names.get(r.mentorId) ?? 'Mentor', requesterId));
}

async function loadOwned(userId: string, id: string): Promise<repo.LiveSessionRow> {
  const session = await repo.findById(id);
  if (!session) throw new LiveSessionError('SESSION_NOT_FOUND', 'Session not found', 404);
  if (session.mentorId !== userId && !(await isUserAdmin(userId))) {
    throw new LiveSessionError('NOT_OWNER', 'You do not own this session', 403);
  }
  return session;
}

/**
 * Decide whether a user may join a session and with what publishing rights.
 * Owner (and admins) publish; anyone else needs read access to the student module.
 */
async function resolveAttend(
  userId: string,
  session: repo.LiveSessionRow,
): Promise<{ canPublish: boolean }> {
  if (session.mentorId === userId) return { canPublish: true };
  if (await isUserAdmin(userId)) return { canPublish: true };
  const perm = await getEffectivePermission(userId, STUDENT_MODULE);
  if (!perm.canRead || !perm.unlocked) {
    throw new LiveSessionError('PERMISSION_DENIED', 'No access to live sessions', 403);
  }
  return { canPublish: false };
}

// --- Mentor operations ---

export async function createSession(
  userId: string,
  input: CreateLiveSessionInput,
): Promise<LiveSessionView> {
  const row = await repo.createSession({
    mentorId: userId,
    title: input.title,
    topic: input.topic ?? 'General',
    status: 'scheduled',
    scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
    startedAt: null,
  });
  const me = await repo.findUserById(userId);
  return toView(row, me?.name ?? 'Mentor', userId);
}

export async function listMine(userId: string): Promise<LiveSessionView[]> {
  return toViews(await repo.listByMentor(userId), userId);
}

export async function updateSchedule(
  userId: string,
  id: string,
  input: UpdateLiveSessionInput,
): Promise<LiveSessionView> {
  const session = await loadOwned(userId, id);
  if (session.status === 'ended' || session.status === 'canceled') {
    throw new LiveSessionError('SESSION_CLOSED', 'Cannot edit a finished session', 409);
  }
  await repo.updateScheduled(id, {
    title: input.title,
    topic: input.topic,
    scheduledFor:
      input.scheduledFor === undefined ? undefined : input.scheduledFor ? new Date(input.scheduledFor) : null,
  });
  const updated = await repo.findById(id);
  const me = await repo.findUserById(userId);
  return toView(updated!, me?.name ?? 'Mentor', userId);
}

export async function startSession(userId: string, id: string): Promise<LiveSessionView> {
  const session = await loadOwned(userId, id);
  if (session.status === 'live') {
    const me = await repo.findUserById(userId);
    return toView(session, me?.name ?? 'Mentor', userId);
  }
  if (session.status !== 'scheduled') {
    throw new LiveSessionError('SESSION_CLOSED', 'This session has already ended', 409);
  }
  await ensureRoom(session.livekitRoom);
  await repo.markLive(id);
  emit('live-session.started', { sessionId: id, mentorId: userId });
  const updated = await repo.findById(id);
  const me = await repo.findUserById(userId);
  return toView(updated!, me?.name ?? 'Mentor', userId);
}

export async function endSession(userId: string, id: string): Promise<LiveSessionView> {
  const session = await loadOwned(userId, id);
  await repo.markEnded(id);
  await repo.closeAllIntervals(id);
  await endRoom(session.livekitRoom);
  emit('live-session.ended', { sessionId: id, mentorId: session.mentorId });
  const updated = await repo.findById(id);
  const me = await repo.findUserById(userId);
  return toView(updated!, me?.name ?? 'Mentor', userId);
}

// --- Student / shared operations ---

export async function listLive(requesterId: string): Promise<LiveSessionView[]> {
  return toViews(await repo.listLive(), requesterId);
}

export async function listUpcoming(requesterId: string): Promise<LiveSessionView[]> {
  return toViews(await repo.listUpcoming(), requesterId);
}

export async function listPast(requesterId: string): Promise<LiveSessionView[]> {
  return toViews(await repo.listPast(), requesterId);
}

export async function getMessages(userId: string, id: string): Promise<ChatMessageView[]> {
  const session = await repo.findById(id);
  if (!session) throw new LiveSessionError('SESSION_NOT_FOUND', 'Session not found', 404);
  await resolveAttend(userId, session);
  const rows = await repo.listMessages(id);
  return rows.map(toMessageView);
}

export async function getJoinToken(userId: string, id: string): Promise<JoinTokenResponse> {
  const session = await repo.findById(id);
  if (!session) throw new LiveSessionError('SESSION_NOT_FOUND', 'Session not found', 404);
  if (session.status !== 'live') {
    throw new LiveSessionError('SESSION_NOT_LIVE', 'This session is not live', 409);
  }
  const { canPublish } = await resolveAttend(userId, session);
  const me = await repo.findUserById(userId);
  const token = await mintToken({
    room: session.livekitRoom,
    identity: userId,
    name: me?.name ?? 'Participant',
    canPublish,
  });
  return { token, wsUrl: env.LIVEKIT_WS_URL, room: session.livekitRoom, canPublish };
}

/** Re-mint a publish-capable token for a promoted student (called from Socket.IO). */
export async function mintPublishToken(sessionId: string, targetUserId: string): Promise<JoinTokenResponse> {
  const session = await repo.findById(sessionId);
  if (!session) throw new LiveSessionError('SESSION_NOT_FOUND', 'Session not found', 404);
  if (session.status !== 'live') {
    throw new LiveSessionError('SESSION_NOT_LIVE', 'This session is not live', 409);
  }
  const target = await repo.findUserById(targetUserId);
  const token = await mintToken({
    room: session.livekitRoom,
    identity: targetUserId,
    name: target?.name ?? 'Participant',
    canPublish: true,
  });
  return { token, wsUrl: env.LIVEKIT_WS_URL, room: session.livekitRoom, canPublish: true };
}

/** Access check used by the Socket.IO layer before joining a session room. */
export async function assertCanAttend(userId: string, sessionId: string): Promise<repo.LiveSessionRow> {
  const session = await repo.findById(sessionId);
  if (!session) throw new LiveSessionError('SESSION_NOT_FOUND', 'Session not found', 404);
  await resolveAttend(userId, session);
  return session;
}

export async function isSessionOwner(userId: string, sessionId: string): Promise<boolean> {
  const session = await repo.findById(sessionId);
  if (!session) return false;
  return session.mentorId === userId || (await isUserAdmin(userId));
}

export async function persistChatMessage(input: {
  sessionId: string;
  userId: string;
  body: string;
}): Promise<ChatMessageView> {
  const author = await repo.findUserById(input.userId);
  const row = await repo.insertMessage({
    sessionId: input.sessionId,
    authorUserId: input.userId,
    authorName: author?.name ?? 'User',
    body: input.body,
  });
  return toMessageView(row);
}

export async function getSummary(userId: string, id: string): Promise<SessionSummary> {
  const session = await loadOwned(userId, id);
  const [attendance, chatCount] = await Promise.all([
    repo.attendanceBySession(id),
    repo.countMessages(id),
  ]);
  const names = await repo.findUserNames(attendance.map((a) => a.userId));
  return {
    session: {
      id: session.id,
      title: session.title,
      topic: session.topic,
      status: session.status as LiveSessionStatus,
      startedAt: iso(session.startedAt),
      endedAt: iso(session.endedAt),
      peakViewers: session.peakViewers,
    },
    chatCount,
    attendees: attendance.map((a) => ({
      userId: a.userId,
      name: names.get(a.userId) ?? 'Student',
      attendedSeconds: a.seconds,
      firstJoin: a.firstJoin.toISOString(),
      lastSeen: a.lastSeen.toISOString(),
    })),
  };
}

function toMessageView(row: repo.ChatMessageRow): ChatMessageView {
  return {
    id: row.id,
    sessionId: row.sessionId,
    authorUserId: row.authorUserId,
    authorName: row.authorName,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

// --- LiveKit webhook handling (authoritative for attendance + viewer counts) ---

function emitViewerCount(sessionId: string, count: number): void {
  const io = tryGetIo();
  io?.in(`session:${sessionId}`).emit('presence:update', { count });
}

export async function handleWebhookEvent(event: WebhookEvent): Promise<void> {
  const roomName = event.room?.name;
  if (!roomName) return;
  const session = await repo.findByRoom(roomName);
  if (!session) {
    logger.warn({ room: roomName, event: event.event }, 'webhook for unknown room');
    return;
  }

  switch (event.event) {
    case 'room_started': {
      await repo.markLive(session.id);
      break;
    }
    case 'participant_joined': {
      const identity = event.participant?.identity;
      if (!identity) break;
      const roleAtJoin = identity === session.mentorId ? 'mentor' : 'student';
      await repo.openInterval({ sessionId: session.id, userId: identity, roleAtJoin });
      if (roleAtJoin === 'student') {
        const count = await repo.incrementViewers(session.id);
        emitViewerCount(session.id, count);
      }
      break;
    }
    case 'participant_left': {
      const identity = event.participant?.identity;
      if (!identity) break;
      const roleAtJoin = identity === session.mentorId ? 'mentor' : 'student';
      await repo.closeInterval(session.id, identity);
      if (roleAtJoin === 'student') {
        const count = await repo.decrementViewers(session.id);
        emitViewerCount(session.id, count);
      }
      break;
    }
    case 'room_finished': {
      await repo.markEnded(session.id);
      await repo.closeAllIntervals(session.id);
      emitViewerCount(session.id, 0);
      emit('live-session.ended', { sessionId: session.id, mentorId: session.mentorId });
      break;
    }
    default:
      break;
  }
}
