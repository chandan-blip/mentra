import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db, type SqlParams } from '../../db.js';
import { createId } from '../../core/id.js';

export type ActivityRow = {
  id: string;
  userId: string;
  type: string;
  source: string;
  metadata: Record<string, unknown> | null;
  durationSeconds: number | null;
  occurredAt: Date;
};

export type NewActivityEvent = {
  userId: string;
  type: string;
  source: string;
  metadata?: Record<string, unknown> | null;
  durationSeconds?: number | null;
  occurredAt?: Date;
};

const ROW_COLS = '`id`, `userId`, `type`, `source`, `metadata`, `durationSeconds`, `occurredAt`';

/** Batch-insert events in a single multi-row statement. */
export async function insertEvents(events: NewActivityEvent[]): Promise<void> {
  if (events.length === 0) return;
  const rows: string[] = [];
  const params: SqlParams = {};
  events.forEach((e, i) => {
    rows.push(`(:id${i}, :userId${i}, :type${i}, :source${i}, :metadata${i}, :duration${i}, :occurredAt${i})`);
    params[`id${i}`] = createId();
    params[`userId${i}`] = e.userId;
    params[`type${i}`] = e.type;
    params[`source${i}`] = e.source;
    params[`metadata${i}`] = e.metadata ? JSON.stringify(e.metadata) : null;
    params[`duration${i}`] = e.durationSeconds ?? null;
    params[`occurredAt${i}`] = e.occurredAt ?? new Date();
  });
  await db.execute<ResultSetHeader>(
    'INSERT INTO `ActivityEvent` (`id`, `userId`, `type`, `source`, `metadata`, `durationSeconds`, `occurredAt`) VALUES ' +
      rows.join(', '),
    params,
  );
}

export async function listRecent(userId: string, limit = 30, types?: string[]): Promise<ActivityRow[]> {
  const params: SqlParams = { userId };
  let typeClause = '';
  if (types && types.length > 0) {
    const names = types.map((t, i) => {
      params[`t${i}`] = t;
      return `:t${i}`;
    });
    typeClause = ` AND \`type\` IN (${names.join(', ')})`;
  }
  const [rows] = await db.execute<(ActivityRow & RowDataPacket)[]>(
    `SELECT ${ROW_COLS} FROM \`ActivityEvent\` WHERE \`userId\` = :userId${typeClause} ` +
      `ORDER BY \`occurredAt\` DESC LIMIT ${Math.trunc(limit)}`,
    params,
  );
  return rows;
}

/** Count events at or after a cutoff (for today / this-week tiles). */
export async function countSince(userId: string, since: Date): Promise<number> {
  const [rows] = await db.execute<(RowDataPacket & { n: number })[]>(
    'SELECT COUNT(*) AS n FROM `ActivityEvent` WHERE `userId` = :userId AND `occurredAt` >= :since',
    { userId, since },
  );
  return Number(rows[0]?.n ?? 0);
}

/** Per-day event counts since a cutoff — powers the heatmap and streak. */
export async function dailyCounts(userId: string, since: Date): Promise<{ day: string; count: number }[]> {
  const [rows] = await db.execute<(RowDataPacket & { day: string; count: number })[]>(
    "SELECT DATE_FORMAT(`occurredAt`, '%Y-%m-%d') AS `day`, COUNT(*) AS `count` " +
      'FROM `ActivityEvent` WHERE `userId` = :userId AND `occurredAt` >= :since ' +
      'GROUP BY `day` ORDER BY `day`',
    { userId, since },
  );
  return rows.map((r) => ({ day: String(r.day), count: Number(r.count) }));
}

// --- AI focus cache ---

export type FocusCacheRow = {
  userId: string;
  payload: unknown;
  signalsHash: string;
  generatedAt: Date;
};

export async function getFocusCache(userId: string): Promise<FocusCacheRow | null> {
  const [rows] = await db.execute<(FocusCacheRow & RowDataPacket)[]>(
    'SELECT `userId`, `payload`, `signalsHash`, `generatedAt` FROM `ActivityFocus` WHERE `userId` = :userId LIMIT 1',
    { userId },
  );
  return rows[0] ?? null;
}

export async function upsertFocusCache(userId: string, payload: unknown, signalsHash: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    'INSERT INTO `ActivityFocus` (`userId`, `payload`, `signalsHash`, `generatedAt`) ' +
      'VALUES (:userId, :payload, :signalsHash, CURRENT_TIMESTAMP(3)) ' +
      'ON DUPLICATE KEY UPDATE `payload` = :payload, `signalsHash` = :signalsHash, `generatedAt` = CURRENT_TIMESTAMP(3)',
    { userId, payload: JSON.stringify(payload), signalsHash },
  );
}
