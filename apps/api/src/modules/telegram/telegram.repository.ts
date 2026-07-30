import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../../db.js';
import { createId } from '../../core/id.js';

/** A row of the `TelegramChannel` table. */
export type TelegramChannelRow = {
  id: string;
  label: string;
  chatId: string;
  purpose: string;
  events: string | null;
  active: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

const COLS =
  '`id`, `label`, `chatId`, `purpose`, `events`, `active`, `sortOrder`, `createdAt`, `updatedAt`';

export async function listChannels(): Promise<TelegramChannelRow[]> {
  const [rows] = await db.execute<(TelegramChannelRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`TelegramChannel\` ORDER BY \`sortOrder\` ASC, \`createdAt\` ASC`,
  );
  return rows;
}

/** Active channels of one purpose — the send path. Ordering keeps output deterministic. */
export async function listActiveByPurpose(purpose: string): Promise<TelegramChannelRow[]> {
  const [rows] = await db.execute<(TelegramChannelRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`TelegramChannel\` WHERE \`active\` = 1 AND \`purpose\` = :purpose ` +
      'ORDER BY `sortOrder` ASC, `createdAt` ASC',
    { purpose },
  );
  return rows;
}

export async function findById(id: string): Promise<TelegramChannelRow | null> {
  const [rows] = await db.execute<(TelegramChannelRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`TelegramChannel\` WHERE \`id\` = :id LIMIT 1`,
    { id },
  );
  return rows[0] ?? null;
}

export async function findByChatId(chatId: string): Promise<TelegramChannelRow | null> {
  const [rows] = await db.execute<(TelegramChannelRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`TelegramChannel\` WHERE \`chatId\` = :chatId LIMIT 1`,
    { chatId },
  );
  return rows[0] ?? null;
}

export async function createChannel(input: {
  label: string;
  chatId: string;
  purpose: string;
  events: string | null;
  sortOrder: number;
}): Promise<TelegramChannelRow> {
  const id = createId();
  await db.execute<ResultSetHeader>(
    'INSERT INTO `TelegramChannel` (`id`, `label`, `chatId`, `purpose`, `events`, `sortOrder`) ' +
      'VALUES (:id, :label, :chatId, :purpose, :events, :sortOrder)',
    { id, ...input },
  );
  const created = await findById(id);
  if (!created) throw new Error('failed to read back created channel');
  return created;
}

export async function updateChannel(
  id: string,
  fields: {
    label?: string;
    chatId?: string;
    purpose?: string;
    events?: string | null;
    active?: boolean;
    sortOrder?: number;
  },
): Promise<void> {
  const sets: string[] = [];
  const params: Record<string, string | number | null> = { id };
  if (fields.label !== undefined) {
    sets.push('`label` = :label');
    params.label = fields.label;
  }
  if (fields.chatId !== undefined) {
    sets.push('`chatId` = :chatId');
    params.chatId = fields.chatId;
  }
  if (fields.purpose !== undefined) {
    sets.push('`purpose` = :purpose');
    params.purpose = fields.purpose;
  }
  if (fields.events !== undefined) {
    sets.push('`events` = :events');
    params.events = fields.events;
  }
  if (fields.active !== undefined) {
    sets.push('`active` = :active');
    params.active = fields.active ? 1 : 0;
  }
  if (fields.sortOrder !== undefined) {
    sets.push('`sortOrder` = :sortOrder');
    params.sortOrder = fields.sortOrder;
  }
  if (sets.length === 0) return;
  await db.execute<ResultSetHeader>(
    `UPDATE \`TelegramChannel\` SET ${sets.join(', ')} WHERE \`id\` = :id`,
    params,
  );
}

export async function removeChannel(id: string): Promise<void> {
  await db.execute<ResultSetHeader>('DELETE FROM `TelegramChannel` WHERE `id` = :id', { id });
}
