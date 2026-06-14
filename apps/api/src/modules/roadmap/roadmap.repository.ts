import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../../db.js';
import { createId } from '../../core/id.js';
import type { RoadmapPlan } from './generator/index.js';

export type RoadmapRow = {
  id: string;
  userId: string;
  status: 'active' | 'archived' | 'superseded';
  generatedBy: string;
  basisAttemptId: string | null;
  totalWeeks: number;
  startedOn: Date;
  archivedAt: Date | null;
  notes: string | null;
};

export type RoadmapWeekRow = {
  id: string;
  roadmapId: string;
  weekNumber: number;
  title: string;
  theme: string | null;
};

export type RoadmapItemRow = {
  id: string;
  weekId: string;
  order: number;
  type: 'topic' | 'project' | 'assessment' | 'session' | 'reading' | 'practice';
  title: string;
  description: string | null;
  skillIds: string[] | null;
  estimatedMin: number | null;
  dependsOnIds: string[] | null;
  status: 'locked' | 'available' | 'in_progress' | 'completed' | 'skipped';
  completedAt: Date | null;
};

export type ItemWithContext = RoadmapItemRow & {
  roadmapId: string;
  userId: string;
  roadmapStatus: RoadmapRow['status'];
};

const ROADMAP_COLS =
  '`id`, `userId`, `status`, `generatedBy`, `basisAttemptId`, `totalWeeks`, `startedOn`, `archivedAt`, `notes`';

export async function findActiveRoadmap(userId: string): Promise<RoadmapRow | null> {
  const [rows] = await db.execute<(RoadmapRow & RowDataPacket)[]>(
    `SELECT ${ROADMAP_COLS} FROM \`Roadmap\` WHERE \`userId\` = :userId AND \`status\` = 'active' LIMIT 1`,
    { userId },
  );
  return rows[0] ?? null;
}

export async function findRoadmapById(id: string): Promise<RoadmapRow | null> {
  const [rows] = await db.execute<(RoadmapRow & RowDataPacket)[]>(
    `SELECT ${ROADMAP_COLS} FROM \`Roadmap\` WHERE \`id\` = :id LIMIT 1`,
    { id },
  );
  return rows[0] ?? null;
}

export async function listRoadmapsByUser(userId: string, limit = 10): Promise<RoadmapRow[]> {
  const [rows] = await db.execute<(RoadmapRow & RowDataPacket)[]>(
    `SELECT ${ROADMAP_COLS} FROM \`Roadmap\` WHERE \`userId\` = :userId ORDER BY \`startedOn\` DESC LIMIT ${Number(limit)}`,
    { userId },
  );
  return rows;
}

export async function listWeeks(roadmapId: string): Promise<RoadmapWeekRow[]> {
  const [rows] = await db.execute<(RoadmapWeekRow & RowDataPacket)[]>(
    'SELECT `id`, `roadmapId`, `weekNumber`, `title`, `theme` FROM `RoadmapWeek` WHERE `roadmapId` = :roadmapId ORDER BY `weekNumber`',
    { roadmapId },
  );
  return rows;
}

export async function listItemsByRoadmap(roadmapId: string): Promise<RoadmapItemRow[]> {
  const [rows] = await db.execute<(RoadmapItemRow & RowDataPacket)[]>(
    `SELECT i.\`id\`, i.\`weekId\`, i.\`order\`, i.\`type\`, i.\`title\`, i.\`description\`, ` +
      'i.`skillIds`, i.`estimatedMin`, i.`dependsOnIds`, i.`status`, i.`completedAt` ' +
      'FROM `RoadmapItem` i JOIN `RoadmapWeek` w ON w.`id` = i.`weekId` ' +
      'WHERE w.`roadmapId` = :roadmapId ORDER BY w.`weekNumber`, i.`order`',
    { roadmapId },
  );
  return rows;
}

export async function findItemWithContext(itemId: string): Promise<ItemWithContext | null> {
  const [rows] = await db.execute<(ItemWithContext & RowDataPacket)[]>(
    `SELECT i.\`id\`, i.\`weekId\`, i.\`order\`, i.\`type\`, i.\`title\`, i.\`description\`, ` +
      'i.`skillIds`, i.`estimatedMin`, i.`dependsOnIds`, i.`status`, i.`completedAt`, ' +
      'w.`roadmapId` AS roadmapId, r.`userId` AS userId, r.`status` AS roadmapStatus ' +
      'FROM `RoadmapItem` i JOIN `RoadmapWeek` w ON w.`id` = i.`weekId` ' +
      'JOIN `Roadmap` r ON r.`id` = w.`roadmapId` WHERE i.`id` = :id LIMIT 1',
    { id: itemId },
  );
  return rows[0] ?? null;
}

export async function updateItemStatus(
  itemId: string,
  status: RoadmapItemRow['status'],
  completedAt: Date | null,
): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `RoadmapItem` SET `status` = :status, `completedAt` = :completedAt WHERE `id` = :id',
    { id: itemId, status, completedAt },
  );
}

export async function setItemsAvailable(itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;
  const placeholders = itemIds.map((_, i) => `:id${i}`).join(', ');
  const params = Object.fromEntries(itemIds.map((id, i) => [`id${i}`, id]));
  await db.execute<ResultSetHeader>(
    `UPDATE \`RoadmapItem\` SET \`status\` = 'available' WHERE \`id\` IN (${placeholders}) AND \`status\` = 'locked'`,
    params,
  );
}

export async function countItems(roadmapId: string): Promise<{ total: number; completed: number }> {
  const [rows] = await db.execute<(RowDataPacket & { total: number; completed: number })[]>(
    "SELECT COUNT(*) AS total, SUM(i.`status` = 'completed') AS completed " +
      'FROM `RoadmapItem` i JOIN `RoadmapWeek` w ON w.`id` = i.`weekId` WHERE w.`roadmapId` = :roadmapId',
    { roadmapId },
  );
  return { total: Number(rows[0]?.total ?? 0), completed: Number(rows[0]?.completed ?? 0) };
}

/** Persist a generated plan as the new active roadmap, archiving any prior active one. */
export async function createRoadmapFromPlan(input: {
  userId: string;
  generatedBy: string;
  basisAttemptId: string | null;
  plan: RoadmapPlan;
}): Promise<string> {
  const conn = await db.getConnection();
  const roadmapId = createId();
  try {
    await conn.beginTransaction();
    await conn.execute(
      "UPDATE `Roadmap` SET `status` = 'archived', `archivedAt` = NOW(3) WHERE `userId` = ? AND `status` = 'active'",
      [input.userId],
    );
    await conn.execute(
      "INSERT INTO `Roadmap` (`id`, `userId`, `status`, `generatedBy`, `basisAttemptId`, `totalWeeks`, `notes`) VALUES (?, ?, 'active', ?, ?, ?, ?)",
      [roadmapId, input.userId, input.generatedBy, input.basisAttemptId, input.plan.totalWeeks, input.plan.notes ?? null],
    );

    const keyToId = new Map<string, string>();
    for (const week of input.plan.weeks) {
      const weekId = createId();
      await conn.execute(
        'INSERT INTO `RoadmapWeek` (`id`, `roadmapId`, `weekNumber`, `title`, `theme`) VALUES (?, ?, ?, ?, ?)',
        [weekId, roadmapId, week.weekNumber, week.title, week.theme ?? null],
      );
      let order = 0;
      for (const item of week.items) {
        const itemId = createId();
        keyToId.set(item.key, itemId);
        const status = week.weekNumber === 1 ? 'available' : 'locked';
        await conn.execute(
          'INSERT INTO `RoadmapItem` (`id`, `weekId`, `order`, `type`, `title`, `description`, `skillIds`, `estimatedMin`, `dependsOnIds`, `status`) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [itemId, weekId, order++, item.type, item.title, item.description ?? null, JSON.stringify(item.skillIds), item.estimatedMin ?? null, JSON.stringify([]), status],
        );
      }
    }

    // Resolve local dep keys → DB ids.
    for (const week of input.plan.weeks) {
      for (const item of week.items) {
        if (item.dependsOn.length === 0) continue;
        const ids = item.dependsOn.map((k) => keyToId.get(k)).filter((x): x is string => Boolean(x));
        const ownId = keyToId.get(item.key);
        if (!ownId) continue;
        await conn.execute('UPDATE `RoadmapItem` SET `dependsOnIds` = ? WHERE `id` = ?', [
          JSON.stringify(ids),
          ownId,
        ]);
      }
    }

    await conn.commit();
    return roadmapId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
