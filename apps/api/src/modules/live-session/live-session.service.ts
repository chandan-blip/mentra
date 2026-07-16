import type {
  ChatMessageView,
  CreateLiveSessionInput,
  CreateUploadInput,
  JoinTokenResponse,
  LikeResultView,
  LiveSessionStatus,
  LiveSessionView,
  SessionSummary,
  UpdateLiveSessionInput,
  UploadInitResponse,
} from '@mentra/shared';
import { MAX_UPLOAD_BYTES } from '@mentra/shared';
import type { WebhookEvent } from 'livekit-server-sdk';
import { EgressStatus } from 'livekit-server-sdk';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { emit } from '../../core/events.js';
import { ensureRoom, endRoom, mintToken, rawRecordingKey } from '../../core/livekit.js';
import { presignPut, r2Delete, r2Enabled, r2Head } from '../../core/r2.js';
import { tryGetIo } from '../../core/realtime.js';
import { getEffectivePermission, isUserAdmin } from '../access/access.service.js';
import { LiveSessionError } from './live-session.errors.js';
import { enqueueTranscode } from './recording.queue.js';
import { enqueueThumbnail } from './thumbnail.queue.js';
import * as repo from './live-session.repository.js';

/** Module keys gating the two surfaces (match the frontend AppLayout guard). */
export const STUDENT_MODULE = 'live-sessions';
export const MENTOR_MODULE = 'mentor-live-sessions';

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/**
 * Fire-and-forget AI cover generation. Best-effort: never blocks or fails the request,
 * and needs R2 to store the rendered PNG. 'create' uses title+topic; 'end' also folds in
 * the session's chat comments. On failure the card falls back to the frame-grab poster.
 */
function requestThumbnail(sessionId: string, phase: 'create' | 'end'): void {
  if (!r2Enabled()) return;
  void enqueueThumbnail(sessionId, phase).catch((err) =>
    logger.warn({ err, sessionId, phase }, 'failed to enqueue thumbnail generation'),
  );
}

function toView(
  row: repo.LiveSessionRow,
  mentor: { name: string; avatarUrl: string | null },
  chatCount: number,
  requesterId: string,
  likeCount = 0,
  likedByViewer = false,
): LiveSessionView {
  return {
    id: row.id,
    mentorId: row.mentorId,
    mentorName: mentor.name,
    mentorAvatarUrl: mentor.avatarUrl,
    title: row.title,
    topic: row.topic,
    status: row.status as LiveSessionStatus,
    scheduledFor: iso(row.scheduledFor),
    startedAt: iso(row.startedAt),
    endedAt: iso(row.endedAt),
    currentViewers: row.currentViewers,
    peakViewers: row.peakViewers,
    chatCount,
    isOwner: row.mentorId === requesterId,
    recordingStatus: row.recordingStatus,
    recordingUrl: row.recordingUrl,
    thumbnailUrl: row.thumbnailUrl,
    visible: Boolean(row.visible),
    isPublic: Boolean(row.isPublic),
    durationSeconds: row.durationSeconds,
    source: row.source,
    likeCount,
    likedByViewer,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function toViews(rows: repo.LiveSessionRow[], requesterId: string): Promise<LiveSessionView[]> {
  const ids = rows.map((r) => r.id);
  const [cards, counts, likeCounts, liked] = await Promise.all([
    repo.findUserCards([...new Set(rows.map((r) => r.mentorId))]),
    repo.countMessagesForSessions(ids),
    repo.countLikesForSessions(ids),
    repo.likedSessionIds(requesterId, ids),
  ]);
  return rows.map((r) =>
    toView(
      r,
      cards.get(r.mentorId) ?? { name: 'Mentor', avatarUrl: null },
      counts.get(r.id) ?? 0,
      requesterId,
      likeCounts.get(r.id) ?? 0,
      liked.has(r.id),
    ),
  );
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
  requestThumbnail(row.id, 'create');
  const me = await repo.findUserById(userId);
  return toView(row, { name: me?.name ?? 'Mentor', avatarUrl: null }, 0, userId);
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
  return (await toViews([updated!], userId))[0]!;
}

export async function startSession(userId: string, id: string): Promise<LiveSessionView> {
  const session = await loadOwned(userId, id);
  if (session.status === 'live') {
    return (await toViews([session], userId))[0]!;
  }
  if (session.status !== 'scheduled') {
    throw new LiveSessionError('SESSION_CLOSED', 'This session has already ended', 409);
  }
  await ensureRoom(session.livekitRoom);
  await repo.markLive(id);
  emit('live-session.started', { sessionId: id, mentorId: userId });
  const updated = await repo.findById(id);
  return (await toViews([updated!], userId))[0]!;
}

export async function endSession(userId: string, id: string): Promise<LiveSessionView> {
  const session = await loadOwned(userId, id);
  await repo.markEnded(id);
  await repo.closeAllIntervals(id);
  await endRoom(session.livekitRoom);
  emit('live-session.ended', { sessionId: id, mentorId: session.mentorId });
  // Refresh the cover now that chat comments exist (best-effort).
  requestThumbnail(id, 'end');
  const updated = await repo.findById(id);
  return (await toViews([updated!], userId))[0]!;
}

// --- Mentor upload (video → same HLS pipeline) ---

/** R2 key for a mentor-uploaded source video (no extension — ffmpeg sniffs the container). */
const uploadKey = (id: string) => `uploads/${id}/source`;

/**
 * Start an upload: create the row and hand back a presigned PUT URL. The browser uploads
 * the file straight to R2, then calls finalizeUpload to kick off transcoding.
 */
export async function createUpload(userId: string, input: CreateUploadInput): Promise<UploadInitResponse> {
  if (!r2Enabled()) {
    throw new LiveSessionError('UPLOAD_DISABLED', 'Uploads are not available right now', 400);
  }
  const row = await repo.createUpload({ mentorId: userId, title: input.title, topic: input.topic });
  requestThumbnail(row.id, 'create');
  const uploadUrl = await presignPut(uploadKey(row.id), input.contentType);
  const me = await repo.findUserById(userId);
  return {
    session: toView(row, { name: me?.name ?? 'Mentor', avatarUrl: null }, 0, userId),
    uploadUrl,
  };
}

/**
 * Finalize an upload after the browser PUT completes: verify the object exists and is
 * within the size cap, then enqueue the same transcode job recordings use.
 */
export async function finalizeUpload(userId: string, id: string): Promise<LiveSessionView> {
  const session = await loadOwned(userId, id);
  if (session.source !== 'upload') {
    throw new LiveSessionError('NOT_UPLOAD', 'This session is not an upload', 400);
  }
  const key = uploadKey(id);
  const head = await r2Head(key);
  if (!head.exists) {
    throw new LiveSessionError('UPLOAD_MISSING', 'No uploaded file was found', 400);
  }
  if (head.size > MAX_UPLOAD_BYTES) {
    await r2Delete(key).catch(() => {});
    await repo.setRecordingStatus(id, 'failed');
    throw new LiveSessionError('UPLOAD_TOO_LARGE', 'The file exceeds the 1 GB limit', 413);
  }
  await enqueueTranscode(id, key);
  const me = await repo.findUserById(userId);
  return toView(session, { name: me?.name ?? 'Mentor', avatarUrl: null }, 0, userId);
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

/** Full view of a single session for the watch page (any authenticated user). */
export async function getOne(userId: string, id: string): Promise<LiveSessionView> {
  const row = await repo.findById(id);
  if (!row) throw new LiveSessionError('SESSION_NOT_FOUND', 'Session not found', 404);
  // Hidden videos are visible only to their owner and admins (managers use the Videos module).
  if (!row.visible && row.mentorId !== userId && !(await isUserAdmin(userId))) {
    throw new LiveSessionError('SESSION_NOT_FOUND', 'Session not found', 404);
  }
  const [cards, counts, likeCount, liked] = await Promise.all([
    repo.findUserCards([row.mentorId]),
    repo.countMessagesForSessions([row.id]),
    repo.countLikes(row.id),
    repo.hasLiked(userId, row.id),
  ]);
  const card = cards.get(row.mentorId);
  return toView(
    row,
    { name: card?.name ?? 'Mentor', avatarUrl: card?.avatarUrl ?? null },
    counts.get(row.id) ?? 0,
    userId,
    likeCount,
    liked,
  );
}

/**
 * Public (no-auth) fetch for a shared video. Only a PUBLIC, visible, fully-transcoded
 * recording is exposed; anything else 404s so private/processing videos never leak. Maps
 * with an empty requester (isOwner/likedByViewer false) — no private fields are returned.
 */
export async function getPublicVideo(id: string): Promise<LiveSessionView> {
  const row = await repo.findById(id);
  if (!row || !row.isPublic || !row.visible || row.recordingStatus !== 'ready' || !row.recordingUrl) {
    throw new LiveSessionError('VIDEO_NOT_FOUND', 'Video not found', 404);
  }
  const [cards, counts, likeCount] = await Promise.all([
    repo.findUserCards([row.mentorId]),
    repo.countMessagesForSessions([row.id]),
    repo.countLikes(row.id),
  ]);
  const card = cards.get(row.mentorId);
  return toView(
    row,
    { name: card?.name ?? 'Mentor', avatarUrl: card?.avatarUrl ?? null },
    counts.get(row.id) ?? 0,
    '',
    likeCount,
    false,
  );
}

// --- Likes ---

/** Like a session (idempotent). Returns the new liked state + total for optimistic UI. */
export async function likeSession(userId: string, id: string): Promise<LikeResultView> {
  const session = await repo.findById(id);
  if (!session) throw new LiveSessionError('SESSION_NOT_FOUND', 'Session not found', 404);
  await repo.insertLike(id, userId);
  return { liked: true, likes: await repo.countLikes(id) };
}

/** Remove a like (idempotent). Returns the new liked state + total. */
export async function unlikeSession(userId: string, id: string): Promise<LikeResultView> {
  const session = await repo.findById(id);
  if (!session) throw new LiveSessionError('SESSION_NOT_FOUND', 'Session not found', 404);
  await repo.deleteLike(id, userId);
  return { liked: false, likes: await repo.countLikes(id) };
}

/**
 * Enroll on a session — the same action as the chat's Enroll button: a like plus a
 * one-time "Enrolled!" comment. Idempotent (re-enrolling won't re-post the comment).
 * Returns the liked state + total so the UI can flip to "Enrolled".
 */
export async function enrollSession(userId: string, id: string): Promise<LikeResultView> {
  const session = await repo.findById(id);
  if (!session) throw new LiveSessionError('SESSION_NOT_FOUND', 'Session not found', 404);
  if (!(await repo.hasLiked(userId, id))) {
    await repo.insertLike(id, userId);
    await persistChatMessage({ sessionId: id, userId, body: 'Enrolled! 🎉 Looking forward to it.' });
  }
  return { liked: true, likes: await repo.countLikes(id) };
}

export async function getMessages(userId: string, id: string): Promise<ChatMessageView[]> {
  const session = await repo.findById(id);
  if (!session) throw new LiveSessionError('SESSION_NOT_FOUND', 'Session not found', 404);
  await resolveAttend(userId, session);
  const rows = await repo.listMessages(id);
  return rows.map(toMessageView);
}

/**
 * Post a comment on a recorded / upcoming session over REST. (Live sessions still chat
 * over Socket.IO for realtime fan-out.) Same attend gate as reading the history.
 */
export async function addMessage(userId: string, id: string, body: string): Promise<ChatMessageView> {
  const session = await repo.findById(id);
  if (!session) throw new LiveSessionError('SESSION_NOT_FOUND', 'Session not found', 404);
  await resolveAttend(userId, session);
  return persistChatMessage({ sessionId: id, userId, body });
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

// --- Watch progress (resume) ---

export async function getProgress(userId: string, sessionId: string): Promise<{ positionSeconds: number }> {
  return { positionSeconds: await repo.getWatchProgress(userId, sessionId) };
}

export async function saveProgress(userId: string, sessionId: string, positionSeconds: number): Promise<void> {
  await repo.upsertWatchProgress(userId, sessionId, Math.max(0, Math.floor(positionSeconds)));
}

function emitViewerCount(sessionId: string, count: number): void {
  const io = tryGetIo();
  io?.in(`session:${sessionId}`).emit('presence:update', { count });
}

export async function handleWebhookEvent(event: WebhookEvent): Promise<void> {
  // Egress lifecycle webhooks carry `egressInfo`, not a room we look up by name.
  if (event.event === 'egress_started' || event.event === 'egress_updated' || event.event === 'egress_ended') {
    await handleEgressEvent(event);
    return;
  }

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

/**
 * Egress lifecycle. On completion we flip the recording to 'processing' and enqueue the
 * FFmpeg transcode (raw MP4 → HLS ladder); the worker marks it 'ready' with the public
 * URL. Any non-complete terminal status marks the recording 'failed'.
 */
async function handleEgressEvent(event: WebhookEvent): Promise<void> {
  const info = event.egressInfo;
  if (!info?.egressId) return;
  const session = await repo.findByEgressId(info.egressId);
  if (!session) {
    logger.warn({ egressId: info.egressId, event: event.event }, 'egress webhook for unknown session');
    return;
  }

  if (event.event !== 'egress_ended') return; // started/updated: status already 'recording'

  if (info.status === EgressStatus.EGRESS_COMPLETE) {
    await repo.setRecordingStatus(session.id, 'processing');
    await enqueueTranscode(session.id, rawRecordingKey(session.id));
    logger.info({ sessionId: session.id, egressId: info.egressId }, 'egress complete → transcoding queued');
  } else {
    await repo.setRecordingStatus(session.id, 'failed');
    logger.error(
      { sessionId: session.id, egressId: info.egressId, status: info.status },
      'egress ended without completing',
    );
  }
}
