import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../db.js';
import { logger } from '../logger.js';

/**
 * Admin-editable operational config, keyed by string, stored in `AppSetting`.
 *
 * This exists for settings an operator must be able to change at runtime without a
 * redeploy — SMM master switches, order quantities, notification routing. Secrets
 * (bot tokens, API keys) still belong in `.env`: they are read at boot by env.ts and
 * are never written here, so a DB dump never carries a credential.
 *
 * Reads never throw. A missing table (migration not yet applied), malformed JSON, or a
 * transient DB error resolves to the caller's fallback — a settings lookup must not be
 * able to take down the request that triggered it.
 */
export async function getSetting(key: string): Promise<string | null> {
  try {
    const [rows] = await db.execute<({ value: string | null } & RowDataPacket)[]>(
      'SELECT `value` FROM `AppSetting` WHERE `key` = :key LIMIT 1',
      { key },
    );
    return rows[0]?.value ?? null;
  } catch (err) {
    logger.error({ err, key }, 'settings: read failed');
    return null;
  }
}

export async function setSetting(key: string, value: string, description?: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    'INSERT INTO `AppSetting` (`key`, `value`, `description`) VALUES (:key, :value, :description) ' +
      'ON DUPLICATE KEY UPDATE `value` = :value, `description` = COALESCE(:description, `description`)',
    { key, value, description: description ?? null },
  );
}

/** Truthy in the way an operator expects: 1 / true / on / yes. Anything else is false. */
export async function getBoolSetting(key: string, fallback = false): Promise<boolean> {
  const raw = await getSetting(key);
  if (raw == null) return fallback;
  const v = raw.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'on' || v === 'yes';
}

export async function setBoolSetting(key: string, value: boolean, description?: string): Promise<void> {
  await setSetting(key, value ? '1' : '0', description);
}

/**
 * JSON setting merged over `defaults`, so a config written before a new field existed
 * still returns that field. Corrupt JSON falls back to the defaults rather than
 * propagating a parse error into the caller.
 */
export async function getJsonSetting<T extends object>(key: string, defaults: T): Promise<T> {
  const raw = await getSetting(key);
  if (!raw) return { ...defaults };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...defaults };
    return { ...defaults, ...(parsed as Partial<T>) };
  } catch (err) {
    logger.error({ err, key }, 'settings: malformed JSON, using defaults');
    return { ...defaults };
  }
}

export async function setJsonSetting<T extends object>(
  key: string,
  value: T,
  description?: string,
): Promise<void> {
  await setSetting(key, JSON.stringify(value), description);
}
