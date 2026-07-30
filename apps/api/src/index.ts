import { createApp } from './app.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { startCleanupWorker } from './core/queue.js';
import { attachRealtime } from './core/realtime.js';
import { seedFlags } from './modules/feature-flags/feature-flags.service.js';
import { registerUserProfileListeners } from './modules/user-profile/index.js';
import { registerAccessListeners } from './modules/access/index.js';
import {
  registerLiveSessionListeners,
  registerLiveSessionSocket,
  startChatFlusher,
} from './modules/live-session/index.js';
import { registerTelegramNotifications } from './modules/telegram/index.js';
import { startSmmWorker } from './modules/smm/index.js';

// --- Boot-time wiring ---
registerUserProfileListeners();
registerAccessListeners();
registerLiveSessionListeners();
registerTelegramNotifications();
startCleanupWorker();
startChatFlusher();
// Drains the SMM order queue. Safe to start unconditionally: with no panel config it
// simply polls an empty table, and webhook enqueues are gated by their own master switch.
startSmmWorker().catch((err: unknown) => logger.error({ err }, 'smm worker failed to start'));
seedFlags().catch((err: unknown) => logger.error({ err }, 'flag seed failed'));

const app = createApp();

const server = app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT, env: env.NODE_ENV }, 'mentra-api listening');
});

// Socket.IO shares the same HTTP server (chat + presence for live sessions).
const io = attachRealtime(server);
registerLiveSessionSocket(io);

let shuttingDown = false;
function shutdown(signal: string) {
  // A second Ctrl+C (or signal) while already shutting down → exit now.
  if (shuttingDown) {
    logger.warn({ signal }, 'second signal — exiting immediately');
    process.exit(1);
  }
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');

  // Hard deadline so a stuck handle (open WebSocket, Redis) can never hang the process.
  // NOT unref'd, so it is guaranteed to fire.
  const force = setTimeout(() => {
    logger.warn('forced exit after timeout');
    process.exit(1);
  }, 3_000);

  // Disconnect Socket.IO first — otherwise keep-alive WS connections keep server.close()
  // from ever completing.
  io.close(() => {
    server.close(() => {
      clearTimeout(force);
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
