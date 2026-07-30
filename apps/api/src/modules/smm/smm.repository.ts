import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../../db.js';
import { createId } from '../../core/id.js';

/** A row of the `SmmQueue` table. */
export type SmmQueueRow = {
  id: string;
  postUrl: string;
  contextLabel: string;
  status: string;
  attempts: number;
  placed: number;
  viewsOrderId: string | null;
  reactionsOrderId: string | null;
  lastError: string | null;
  startedAt: Date | null;
  processedAt: Date | null;
  createdAt: Date;
};

const COLS =
  '`id`, `postUrl`, `contextLabel`, `status`, `attempts`, `placed`, `viewsOrderId`, ' +
  '`reactionsOrderId`, `lastError`, `startedAt`, `processedAt`, `createdAt`';

/**
 * Idempotent insert. `postUrl` is UNIQUE, so a post that is already queued — because a
 * producer enqueued it and Telegram then re-delivered the same update — is a silent
 * no-op returning null, never a second order for the same post.
 */
export async function enqueue(postUrl: string, contextLabel: string): Promise<string | null> {
  const id = createId();
  const [res] = await db.execute<ResultSetHeader>(
    'INSERT IGNORE INTO `SmmQueue` (`id`, `postUrl`, `contextLabel`, `status`) ' +
      "VALUES (:id, :postUrl, :contextLabel, 'pending')",
    { id, postUrl: postUrl.slice(0, 500), contextLabel: contextLabel.slice(0, 64) },
  );
  return res.affectedRows > 0 ? id : null;
}

export async function findById(id: string): Promise<SmmQueueRow | null> {
  const [rows] = await db.execute<(SmmQueueRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`SmmQueue\` WHERE \`id\` = :id LIMIT 1`,
    { id },
  );
  return rows[0] ?? null;
}

export async function list(limit = 100): Promise<SmmQueueRow[]> {
  const [rows] = await db.execute<(SmmQueueRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`SmmQueue\` ORDER BY \`createdAt\` DESC LIMIT ${Math.min(Math.max(limit, 1), 500)}`,
  );
  return rows;
}

export async function counts(): Promise<Record<string, number>> {
  const [rows] = await db.execute<({ status: string; n: number } & RowDataPacket)[]>(
    'SELECT `status`, COUNT(*) AS `n` FROM `SmmQueue` GROUP BY `status`',
  );
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
}

/**
 * Claim the oldest pending row. The UPDATE ... WHERE status='pending' is the lock:
 * only the statement that actually changes the row wins, so a second worker (or a
 * restarted one racing the old process) can never claim the same row.
 */
export async function claimNextPending(): Promise<SmmQueueRow | null> {
  const [candidates] = await db.execute<({ id: string } & RowDataPacket)[]>(
    "SELECT `id` FROM `SmmQueue` WHERE `status` = 'pending' ORDER BY `createdAt` ASC LIMIT 1",
  );
  const id = candidates[0]?.id;
  if (!id) return null;

  const [res] = await db.execute<ResultSetHeader>(
    "UPDATE `SmmQueue` SET `status` = 'processing', `startedAt` = NOW(3), `attempts` = `attempts` + 1 " +
      "WHERE `id` = :id AND `status` = 'pending'",
    { id },
  );
  if (res.affectedRows === 0) return null; // lost the race — next tick picks up the rest
  return findById(id);
}

export async function markDone(
  id: string,
  fields: { placed: number; viewsOrderId: string | null; reactionsOrderId: string | null; lastError: string | null },
): Promise<void> {
  await db.execute<ResultSetHeader>(
    "UPDATE `SmmQueue` SET `status` = 'done', `placed` = :placed, `viewsOrderId` = :viewsOrderId, " +
      '`reactionsOrderId` = :reactionsOrderId, `lastError` = :lastError, `processedAt` = NOW(3) WHERE `id` = :id',
    {
      id,
      placed: fields.placed,
      viewsOrderId: fields.viewsOrderId,
      reactionsOrderId: fields.reactionsOrderId,
      lastError: fields.lastError ? fields.lastError.slice(0, 2000) : null,
    },
  );
}

export async function markFailed(id: string, error: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    "UPDATE `SmmQueue` SET `status` = 'failed', `lastError` = :error, `processedAt` = NOW(3) WHERE `id` = :id",
    { id, error: error.slice(0, 2000) },
  );
}

/** Back to pending for another attempt; keeps the error so the UI shows why it retried. */
export async function requeue(id: string, error: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    "UPDATE `SmmQueue` SET `status` = 'pending', `startedAt` = NULL, `lastError` = :error WHERE `id` = :id",
    { id, error: error.slice(0, 2000) },
  );
}

/** Boot recovery: rows the previous process died mid-flight on would otherwise stick. */
export async function resetProcessing(): Promise<number> {
  const [res] = await db.execute<ResultSetHeader>(
    "UPDATE `SmmQueue` SET `status` = 'pending', `startedAt` = NULL WHERE `status` = 'processing'",
  );
  return res.affectedRows;
}

/** Manual retry from the admin UI — only meaningful for a terminal row. */
export async function retry(id: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    "UPDATE `SmmQueue` SET `status` = 'pending', `attempts` = 0, `startedAt` = NULL, `processedAt` = NULL " +
      "WHERE `id` = :id AND `status` IN ('failed', 'done')",
    { id },
  );
}

export async function remove(id: string): Promise<void> {
  await db.execute<ResultSetHeader>('DELETE FROM `SmmQueue` WHERE `id` = :id', { id });
}

/** Housekeeping — terminal rows older than `days`. Keeps the table small over years. */
export async function purgeOlderThan(days: number): Promise<number> {
  const [res] = await db.execute<ResultSetHeader>(
    "DELETE FROM `SmmQueue` WHERE `status` IN ('done', 'failed') AND `processedAt` < DATE_SUB(NOW(), INTERVAL :days DAY)",
    { days },
  );
  return res.affectedRows;
}
