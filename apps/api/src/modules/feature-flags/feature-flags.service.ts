import type { NextFunction, Request, Response } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../../db.js';
import { redis } from '../../core/redis.js';
import { logger } from '../../logger.js';

const CACHE_PREFIX = 'flag:';
const CACHE_TTL_SECONDS = 30;

type FlagRow = { key: string; enabled: 0 | 1 } & RowDataPacket;

/** Flags this build knows about, with their default state when no row exists yet. */
export const FLAG_DEFAULTS: Record<string, { enabled: boolean; description: string }> = {
  'profile.resume.upload': { enabled: true, description: 'Kill switch for the resume upload feature' },
  'dashboard.enabled': { enabled: true, description: 'Master kill switch for the dashboard' },
  'dashboard.widget.dailyTasks': { enabled: false, description: 'Daily tasks widget (later phase)' },
  'dashboard.widget.liveSessions': { enabled: false, description: 'Live sessions widget (later phase)' },
};

export async function isEnabled(key: string): Promise<boolean> {
  const cached = await redis.get(CACHE_PREFIX + key);
  if (cached !== null) return cached === '1';

  const [rows] = await db.execute<FlagRow[]>(
    'SELECT `key`, `enabled` FROM `FeatureFlag` WHERE `key` = :key LIMIT 1',
    { key },
  );
  const enabled = rows[0] ? Boolean(rows[0].enabled) : (FLAG_DEFAULTS[key]?.enabled ?? false);

  await redis.set(CACHE_PREFIX + key, enabled ? '1' : '0', 'EX', CACHE_TTL_SECONDS);
  return enabled;
}

export async function setEnabled(key: string, enabled: boolean): Promise<void> {
  await db.execute<ResultSetHeader>(
    'INSERT INTO `FeatureFlag` (`key`, `enabled`) VALUES (:key, :enabled) ' +
      'ON DUPLICATE KEY UPDATE `enabled` = :enabled',
    { key, enabled },
  );
  await redis.del(CACHE_PREFIX + key);
}

/** Ensures known flags have a row, so they show up in admin tooling. Idempotent. */
export async function seedFlags(): Promise<void> {
  for (const [key, { enabled, description }] of Object.entries(FLAG_DEFAULTS)) {
    await db.execute<ResultSetHeader>(
      'INSERT IGNORE INTO `FeatureFlag` (`key`, `enabled`, `description`) VALUES (:key, :enabled, :description)',
      { key, enabled, description },
    );
  }
  logger.info({ flags: Object.keys(FLAG_DEFAULTS) }, 'feature flags seeded');
}

/** Express guard: 404 when the flag is off (feature shouldn't appear to exist). */
export function requireFlag(key: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    isEnabled(key)
      .then((enabled) => {
        if (enabled) return next();
        res.status(404).json({ error: { code: 'FEATURE_DISABLED', message: 'Feature not available' } });
      })
      .catch((err: unknown) => {
        req.log.error({ err, key }, 'flag check failed');
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
      });
  };
}
