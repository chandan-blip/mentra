import { createApp } from './app.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { startCleanupWorker } from './core/queue.js';
import { attachRealtime } from './core/realtime.js';
import { seedFlags } from './modules/feature-flags/feature-flags.service.js';
import { registerUserProfileListeners } from './modules/user-profile/index.js';
import { registerRoadmapListeners } from './modules/roadmap/index.js';
import { registerAssignmentListeners } from './modules/assignment/index.js';
import { registerLiveSessionListeners, registerLiveSessionSocket } from './modules/live-session/index.js';

// --- Boot-time wiring ---
registerUserProfileListeners();
registerAssignmentListeners();
registerRoadmapListeners();
registerLiveSessionListeners();
startCleanupWorker();
seedFlags().catch((err: unknown) => logger.error({ err }, 'flag seed failed'));

const app = createApp();

const server = app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT, env: env.NODE_ENV }, 'mentra-api listening');
});

// Socket.IO shares the same HTTP server (chat + presence for live sessions).
const io = attachRealtime(server);
registerLiveSessionSocket(io);

function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close((err) => {
    if (err) {
      logger.error({ err }, 'error during shutdown');
      process.exit(1);
    }
    process.exit(0);
  });
  setTimeout(() => {
    logger.warn('forced exit after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
