import type { ChatMessageView } from '@mentra/shared';
import { createId } from '../../core/id.js';
import { redis } from '../../core/redis.js';
import { logger } from '../../logger.js';
import * as repo from './live-session.repository.js';

/**
 * Chat write-batching. Sending a message broadcasts immediately (snappy) and pushes the
 * row onto a Redis buffer; a periodic flusher bulk-inserts the buffer to MySQL. This
 * keeps the DB off the hot path so chat stays responsive under load, while the buffer
 * (durable in Redis) survives a restart — the next flush drains whatever was queued.
 */

const BUFFER_KEY = 'live:chat:buffer';
const FLUSH_INTERVAL_MS = 3_000;
const FLUSH_BATCH = 500;

/** Author names rarely change mid-session; cache to avoid a DB read per message. */
const nameCache = new Map<string, string>();

async function authorName(userId: string): Promise<string> {
  const cached = nameCache.get(userId);
  if (cached) return cached;
  const user = await repo.findUserById(userId);
  const name = user?.name ?? 'User';
  nameCache.set(userId, name);
  return name;
}

/**
 * Build the message to broadcast NOW and queue it for a later batched DB write.
 * The returned view is what gets emitted to the room; persistence is deferred.
 */
export async function bufferChatMessage(input: {
  sessionId: string;
  userId: string;
  body: string;
}): Promise<ChatMessageView> {
  const message: ChatMessageView = {
    id: createId(),
    sessionId: input.sessionId,
    authorUserId: input.userId,
    authorName: await authorName(input.userId),
    body: input.body,
    createdAt: new Date().toISOString(),
  };
  await redis.rpush(BUFFER_KEY, JSON.stringify(message));
  return message;
}

/**
 * Atomically read+remove up to N items from the head of the list. Avoids `LPOP key count`
 * (Redis ≥ 6.2 only) so it works on older servers; the script runs atomically, so even
 * concurrent flushers never double-read or drop messages.
 */
const POP_BATCH_LUA = `
local items = redis.call('LRANGE', KEYS[1], 0, ARGV[1] - 1)
if #items > 0 then
  redis.call('LTRIM', KEYS[1], #items, -1)
end
return items
`;

let timer: NodeJS.Timeout | null = null;

/** Start the periodic flusher (idempotent). Call once at API boot. */
export function startChatFlusher(): void {
  if (timer) return;
  timer = setInterval(() => void flushChatBuffer(), FLUSH_INTERVAL_MS);
  timer.unref?.();
  logger.info({ everyMs: FLUSH_INTERVAL_MS }, 'chat flusher started');
}

/** Drain up to FLUSH_BATCH buffered messages into MySQL in one insert. */
export async function flushChatBuffer(): Promise<void> {
  try {
    const raw = (await redis.eval(POP_BATCH_LUA, 1, BUFFER_KEY, String(FLUSH_BATCH))) as string[] | null;
    if (!raw || raw.length === 0) return;
    const rows = raw.map((s) => {
      const m = JSON.parse(s) as ChatMessageView;
      return {
        id: m.id,
        sessionId: m.sessionId,
        authorUserId: m.authorUserId,
        authorName: m.authorName,
        body: m.body,
        createdAt: new Date(m.createdAt),
      };
    });
    await repo.insertMessages(rows);
    logger.debug({ count: rows.length }, 'flushed chat messages');
  } catch (err) {
    logger.error({ err }, 'chat flush failed');
  }
}
