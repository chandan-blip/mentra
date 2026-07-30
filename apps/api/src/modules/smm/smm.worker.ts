import { logger } from '../../logger.js';
import * as repo from './smm.repository.js';
import { placeOrdersForPost } from './smm.service.js';

/**
 * Single paced worker draining `SmmQueue`.
 *
 * Deliberately one row at a time with a randomised gap: SMM panels rate-limit and
 * penalise bursts, so throughput is not the goal — steady, human-looking pacing is.
 * The queue exists to decouple that pacing from the Telegram webhook, which must answer
 * in milliseconds or Telegram retries the update.
 */
const IDLE_POLL_MS = 5_000;
const GAP_MIN_MS = 10_000;
const GAP_MAX_MS = 20_000;
const MAX_ATTEMPTS = 3;
const PURGE_AFTER_DAYS = 30;
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

let running = false;
let stopping = false;
let purgeTimer: NodeJS.Timeout | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function gapMs(): number {
  return GAP_MIN_MS + Math.floor(Math.random() * (GAP_MAX_MS - GAP_MIN_MS + 1));
}

export async function startSmmWorker(): Promise<void> {
  if (running) return;
  running = true;
  stopping = false;

  // Anything left 'processing' belongs to a process that died mid-order. Without this
  // those rows are stranded forever — nothing else ever transitions them.
  try {
    const recovered = await repo.resetProcessing();
    if (recovered > 0) logger.warn({ recovered }, 'smm worker: recovered stuck processing rows');
  } catch (err) {
    logger.error({ err }, 'smm worker: boot recovery failed');
  }

  purgeTimer = setInterval(() => {
    repo
      .purgeOlderThan(PURGE_AFTER_DAYS)
      .then((n) => {
        if (n > 0) logger.info({ purged: n }, 'smm worker: purged old queue rows');
      })
      .catch((err: unknown) => logger.error({ err }, 'smm worker: purge failed'));
  }, PURGE_INTERVAL_MS);
  purgeTimer.unref();

  logger.info('smm worker: started');
  void supervise();
}

export function stopSmmWorker(): void {
  stopping = true;
  running = false;
  if (purgeTimer) {
    clearInterval(purgeTimer);
    purgeTimer = null;
  }
}

/** Restart the loop if it ever throws — a dead worker leaves every row pending forever. */
async function supervise(): Promise<void> {
  try {
    await loop();
  } catch (err) {
    logger.error({ err }, 'smm worker: crashed, restarting in 5s');
    if (stopping) {
      running = false;
      return;
    }
    await sleep(5_000);
    if (!stopping) void supervise();
    else running = false;
  }
}

async function loop(): Promise<void> {
  while (!stopping) {
    const row = await repo.claimNextPending();
    if (!row) {
      await sleep(IDLE_POLL_MS);
      continue;
    }
    try {
      await processRow(row);
    } catch (err) {
      logger.error({ err, id: row.id }, 'smm worker: unexpected row error');
    }
    if (!stopping) await sleep(gapMs());
  }
  logger.info('smm worker: stopped');
}

async function processRow(row: Awaited<ReturnType<typeof repo.claimNextPending>>): Promise<void> {
  if (!row) return;
  try {
    const outcome = await placeOrdersForPost(row.postUrl);

    // "Skipped" means the config says don't order — a settled answer, not a failure.
    // Retrying it would just burn attempts until the row lands in `failed` and looks
    // like something broke.
    if (outcome.skipped) {
      await repo.markDone(row.id, {
        placed: 0,
        viewsOrderId: null,
        reactionsOrderId: null,
        lastError: outcome.reason ?? null,
      });
      return;
    }

    if (outcome.placed > 0) {
      await repo.markDone(row.id, {
        placed: outcome.placed,
        viewsOrderId: outcome.viewsOrderId,
        reactionsOrderId: outcome.reactionsOrderId,
        lastError: outcome.errors.length ? outcome.errors.join(' | ') : null,
      });
      return;
    }

    await retryOrFail(row.id, row.attempts, outcome.errors.join(' | ') || 'No orders placed');
  } catch (err) {
    await retryOrFail(row.id, row.attempts, err instanceof Error ? err.message : String(err));
  }
}

async function retryOrFail(id: string, attempts: number, error: string): Promise<void> {
  if (attempts >= MAX_ATTEMPTS) await repo.markFailed(id, error);
  else await repo.requeue(id, error);
}
