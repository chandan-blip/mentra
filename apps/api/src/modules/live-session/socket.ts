import { chatSendSchema } from '@mentra/shared';
import { logger } from '../../logger.js';
import type { AppIo, AppSocket } from '../../core/realtime.js';
import { assertCanAttend, isSessionOwner, mintPublishToken } from './live-session.service.js';
import { bufferChatMessage } from './chat-buffer.js';
import { findUserById } from './live-session.repository.js';

const room = (sessionId: string) => `session:${sessionId}`;
const mentorRoom = (sessionId: string) => `session:${sessionId}:mentor`;
const userRoom = (userId: string) => `user:${userId}`;

/**
 * Wire live-session realtime onto the authenticated Socket.IO server. Chat is
 * persisted server-side (so "who chatted" is always recorded); presence/raise-hand
 * are live-only. Attendance duration is owned by LiveKit webhooks, not this layer.
 */
export function registerLiveSessionSocket(io: AppIo): void {
  io.on('connection', (socket: AppSocket) => {
    const { userId } = socket.data;
    // Personal room so we can push a re-minted token to a specific user's sockets.
    void socket.join(userRoom(userId));

    socket.on('live:join', async (payload: { sessionId?: string }) => {
      const sessionId = String(payload?.sessionId ?? '');
      if (!sessionId) return;
      try {
        const session = await assertCanAttend(userId, sessionId);
        await socket.join(room(sessionId));
        if (session.mentorId === userId) await socket.join(mentorRoom(sessionId));
        socket.emit('presence:update', { count: session.currentViewers });
      } catch (err) {
        socket.emit('live:error', { code: 'JOIN_DENIED', message: 'Cannot join this session' });
        logger.debug({ err, sessionId, userId }, 'live:join denied');
      }
    });

    socket.on('live:leave', (payload: { sessionId?: string }) => {
      const sessionId = String(payload?.sessionId ?? '');
      if (sessionId) {
        void socket.leave(room(sessionId));
        void socket.leave(mentorRoom(sessionId));
      }
    });

    socket.on('chat:send', async (payload: unknown) => {
      const parsed = chatSendSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('live:error', { code: 'INVALID_MESSAGE', message: 'Message is empty or too long' });
        return;
      }
      const { sessionId, body } = parsed.data;
      // Must have joined the room (which ran the access check) to chat.
      if (!socket.rooms.has(room(sessionId))) {
        socket.emit('live:error', { code: 'NOT_JOINED', message: 'Join the session first' });
        return;
      }
      try {
        // Broadcast immediately; the DB write is batched by the flusher (chat-buffer).
        const message = await bufferChatMessage({ sessionId, userId, body });
        io.in(room(sessionId)).emit('chat:new', message);
      } catch (err) {
        logger.error({ err, sessionId, userId }, 'chat:send failed');
        socket.emit('live:error', { code: 'CHAT_FAILED', message: 'Could not send message' });
      }
    });

    socket.on('hand:raise', async (payload: { sessionId?: string }) => {
      const sessionId = String(payload?.sessionId ?? '');
      if (!sessionId || !socket.rooms.has(room(sessionId))) return;
      const me = await findUserById(userId);
      io.in(mentorRoom(sessionId)).emit('hand:raised', {
        userId,
        name: me?.name ?? 'Student',
      });
    });

    socket.on('hand:approve', async (payload: { sessionId?: string; targetUserId?: string }) => {
      const sessionId = String(payload?.sessionId ?? '');
      const targetUserId = String(payload?.targetUserId ?? '');
      if (!sessionId || !targetUserId) return;
      if (!(await isSessionOwner(userId, sessionId))) {
        socket.emit('live:error', { code: 'NOT_OWNER', message: 'Only the mentor can approve' });
        return;
      }
      try {
        const grant = await mintPublishToken(sessionId, targetUserId);
        io.in(userRoom(targetUserId)).emit('live:promoted', grant);
      } catch (err) {
        logger.error({ err, sessionId, targetUserId }, 'hand:approve failed');
      }
    });
  });
}
