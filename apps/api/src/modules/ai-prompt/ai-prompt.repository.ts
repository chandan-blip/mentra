import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../../db.js';

/**
 * Data access for AI prompt overrides. The `AiPrompt` table holds ONLY rows a manager
 * has customized — the defaults live in the code registry. No FK constraints (project
 * convention); the `key` is a plain string matching a registry key.
 */

export type AiPromptRow = {
  key: string;
  systemPrompt: string;
  temperature: number | null;
  updatedBy: string | null;
  updatedAt: Date;
};

const COLS = '`key`, `systemPrompt`, `temperature`, `updatedBy`, `updatedAt`';

/** Every stored override, keyed by prompt key. */
export async function findAllOverrides(): Promise<Map<string, AiPromptRow>> {
  const [rows] = await db.execute<(AiPromptRow & RowDataPacket)[]>(`SELECT ${COLS} FROM \`AiPrompt\``);
  return new Map(rows.map((r) => [r.key, r]));
}

export async function findOverride(key: string): Promise<AiPromptRow | null> {
  const [rows] = await db.execute<(AiPromptRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`AiPrompt\` WHERE \`key\` = :key LIMIT 1`,
    { key },
  );
  return rows[0] ?? null;
}

export async function upsertOverride(input: {
  key: string;
  systemPrompt: string;
  temperature: number | null;
  updatedBy: string | null;
}): Promise<void> {
  await db.execute<ResultSetHeader>(
    'INSERT INTO `AiPrompt` (`key`, `systemPrompt`, `temperature`, `updatedBy`) ' +
      'VALUES (:key, :systemPrompt, :temperature, :updatedBy) ' +
      'ON DUPLICATE KEY UPDATE `systemPrompt` = :systemPrompt, `temperature` = :temperature, ' +
      '`updatedBy` = :updatedBy, `updatedAt` = NOW(3)',
    input,
  );
}

export async function deleteOverride(key: string): Promise<void> {
  await db.execute<ResultSetHeader>('DELETE FROM `AiPrompt` WHERE `key` = :key', { key });
}
