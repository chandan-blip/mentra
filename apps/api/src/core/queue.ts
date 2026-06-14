import { Queue, Worker } from 'bullmq';
import { createBullConnection } from './redis.js';
import { deleteObject } from './storage.js';
import { logger } from '../logger.js';

const CLEANUP_QUEUE = 'cleanup';

type ObjectDeleteJob = { type: 'object-delete'; key: string };

export const cleanupQueue = new Queue<ObjectDeleteJob>(CLEANUP_QUEUE, {
  connection: createBullConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

/** Schedule an object for deletion. Default 24h delay = soft-delete window for recovery. */
export async function enqueueObjectDelete(key: string, delayMs = 24 * 60 * 60 * 1000): Promise<void> {
  await cleanupQueue.add('object-delete', { type: 'object-delete', key }, { delay: delayMs });
  logger.info({ key, delayMs }, 'object deletion enqueued');
}

let worker: Worker<ObjectDeleteJob> | null = null;

export function startCleanupWorker(): Worker<ObjectDeleteJob> {
  if (worker) return worker;
  worker = new Worker<ObjectDeleteJob>(
    CLEANUP_QUEUE,
    async (job) => {
      if (job.data.type === 'object-delete') {
        await deleteObject(job.data.key);
        logger.info({ key: job.data.key }, 'object deleted by cleanup worker');
      }
    },
    { connection: createBullConnection() },
  );
  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id }, 'cleanup job failed'));
  return worker;
}
