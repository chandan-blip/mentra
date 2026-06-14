import type { Server as HttpServer } from 'node:http';
import { Server, type Socket, type DefaultEventsMap } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { redis } from './redis.js';
import { verifyAccessToken } from '../modules/auth/tokens.js';

/**
 * Socket.IO transport for live-session realtime (chat + presence + raise-hand).
 * Attaches to the SAME http.Server as Express (so it shares the port), authenticates
 * the handshake with our existing access JWT, and uses the Redis adapter so chat and
 * presence broadcast correctly across multiple API instances.
 *
 * Domain event wiring lives in the live-session module (registerLiveSessionSocket);
 * this file only owns transport, auth and the adapter.
 */

export type SocketData = {
  userId: string;
  role: 'student' | 'mentor' | 'admin';
};

export type AppSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;
export type AppIo = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

let io: AppIo | null = null;

export function attachRealtime(server: HttpServer): AppIo {
  if (io) return io;

  io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin: env.NODE_ENV === 'development' ? true : env.WEB_APP_ORIGIN,
      credentials: true,
    },
  });

  // Cross-instance broadcast. Two dedicated connections (pub/sub) per BullMQ-style
  // convention; the shared client stays free for caching.
  const pub = redis.duplicate();
  const sub = redis.duplicate();
  pub.on('error', (err) => logger.error({ err }, 'redis (socket pub) error'));
  sub.on('error', (err) => logger.error({ err }, 'redis (socket sub) error'));
  io.adapter(createAdapter(pub, sub));

  // Authenticate the handshake with the access token (passed via `auth.token`).
  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string } | undefined)?.token;
    if (!token) {
      next(new Error('AUTH_REQUIRED'));
      return;
    }
    try {
      const claims = verifyAccessToken(token);
      socket.data.userId = claims.sub;
      socket.data.role = claims.role;
      next();
    } catch {
      next(new Error('AUTH_INVALID'));
    }
  });

  logger.info('socket.io realtime attached');
  return io;
}

/** The live Socket.IO server. Throws if realtime hasn't been attached yet. */
export function getIo(): AppIo {
  if (!io) throw new Error('realtime not initialized — call attachRealtime(server) first');
  return io;
}

/** Safe accessor for callers that may run before/without realtime (e.g. tests). */
export function tryGetIo(): AppIo | null {
  return io;
}
