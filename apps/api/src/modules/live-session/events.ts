import { on } from '../../core/events.js';
import { logger } from '../../logger.js';
import { egressEnabled, startEgress, stopEgress } from '../../core/livekit.js';
import * as repo from './live-session.repository.js';

/**
 * Live-session domain listeners. Beyond observability, these drive **recording**:
 * a session going live starts a composite egress to R2; ending it stops the egress.
 * The egress completion webhook (in the service) then kicks off transcoding. All of it
 * is gated on `egressEnabled()` (R2 configured) and best-effort — a recording failure
 * never breaks the live session itself.
 */
export function registerLiveSessionListeners(): void {
  on('live-session.started', async ({ sessionId, mentorId }) => {
    logger.info({ sessionId, mentorId }, 'live session started');
    if (!egressEnabled()) return;
    try {
      const session = await repo.findById(sessionId);
      if (!session) return;
      // Idempotent: a re-start (or duplicate event) must not spawn a second egress.
      if (session.egressId) return;
      const egressId = await startEgress(session.livekitRoom, sessionId);
      await repo.setEgress(sessionId, egressId);
      logger.info({ sessionId, egressId }, 'recording egress started');
    } catch (err) {
      logger.error({ err, sessionId }, 'failed to start recording egress');
    }
  });

  on('live-session.ended', async ({ sessionId, mentorId }) => {
    logger.info({ sessionId, mentorId }, 'live session ended');
    if (!egressEnabled()) return;
    try {
      const session = await repo.findById(sessionId);
      if (!session?.egressId) return;
      await stopEgress(session.egressId);
      // The egress_ended webhook flips status → 'processing' and enqueues transcoding.
      logger.info({ sessionId, egressId: session.egressId }, 'recording egress stop requested');
    } catch (err) {
      logger.error({ err, sessionId }, 'failed to stop recording egress');
    }
  });
}
