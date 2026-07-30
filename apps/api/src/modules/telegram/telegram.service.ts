import { logger } from '../../logger.js';
import * as client from './telegram.client.js';
import { TelegramError } from './telegram.errors.js';
import * as repo from './telegram.repository.js';
import type { TelegramChannelRow } from './telegram.repository.js';

/**
 * Channel registry + the notification fan-out.
 *
 * A channel has a `purpose`: 'notify' channels receive event messages, 'smm' channels
 * are the public ones whose posts the webhook enqueues for SMM orders. One bot token
 * (env) serves both — only the chat ids differ.
 */

/** Events an operator can route to a channel. Keys are stored in `TelegramChannel.events`. */
export const NOTIFY_EVENTS = [
  { key: 'lead.enquiry', label: 'New landing enquiry' },
  { key: 'user.signup', label: 'New user signup' },
  { key: 'support.message', label: 'Support / chat message' },
] as const;

export type NotifyEventKey = (typeof NOTIFY_EVENTS)[number]['key'];

const EVENT_KEYS: readonly string[] = NOTIFY_EVENTS.map((e) => e.key);
const PURPOSES = ['notify', 'smm'] as const;

export type TelegramChannelView = {
  id: string;
  label: string;
  chatId: string;
  purpose: string;
  events: string[];
  active: boolean;
  sortOrder: number;
  createdAt: string;
};

function toView(row: TelegramChannelRow): TelegramChannelView {
  return {
    id: row.id,
    label: row.label,
    chatId: row.chatId,
    purpose: row.purpose,
    events: parseEvents(row.events),
    active: Boolean(row.active),
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Stored as a JSON array. Empty/absent/corrupt means "every event" — never "none". */
function parseEvents(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

export async function listChannels(): Promise<TelegramChannelView[]> {
  return (await repo.listChannels()).map(toView);
}

export type ChannelInput = {
  label: string;
  chatId: string;
  purpose?: string;
  events?: string[];
  sortOrder?: number;
};

function normalizeChatId(raw: string): string {
  const value = raw.trim();
  if (!value) throw new TelegramError('INVALID_CHAT_ID', 'Chat id is required', 400);
  // Two accepted forms: a numeric id (-1001234567890) or a public @username. Anything
  // else (a t.me URL, a bare name) is a paste mistake that would fail silently at send
  // time, so reject it here where the admin can see why.
  if (/^-?\d+$/.test(value)) return value;
  if (/^@[A-Za-z0-9_]{4,}$/.test(value)) return value;
  const fromUrl = /^https?:\/\/t\.me\/([A-Za-z0-9_]{4,})\/?$/.exec(value);
  if (fromUrl) return `@${fromUrl[1]}`;
  throw new TelegramError(
    'INVALID_CHAT_ID',
    'Chat id must be a numeric id like -1001234567890 or a public @username',
    400,
  );
}

function normalizePurpose(raw: string | undefined): string {
  const value = (raw ?? 'notify').trim();
  if (!PURPOSES.includes(value as (typeof PURPOSES)[number])) {
    throw new TelegramError('INVALID_PURPOSE', `Purpose must be one of: ${PURPOSES.join(', ')}`, 400);
  }
  return value;
}

function normalizeEvents(events: string[] | undefined): string | null {
  if (!events || events.length === 0) return null; // null = all events
  const unknown = events.filter((e) => !EVENT_KEYS.includes(e));
  if (unknown.length) {
    throw new TelegramError('INVALID_EVENT', `Unknown event(s): ${unknown.join(', ')}`, 400);
  }
  return JSON.stringify([...new Set(events)]);
}

export async function createChannel(input: ChannelInput): Promise<TelegramChannelView> {
  const chatId = normalizeChatId(input.chatId);
  if (await repo.findByChatId(chatId)) {
    throw new TelegramError('DUPLICATE_CHAT_ID', 'That chat is already configured', 409);
  }
  const row = await repo.createChannel({
    label: input.label.trim(),
    chatId,
    purpose: normalizePurpose(input.purpose),
    events: normalizeEvents(input.events),
    sortOrder: input.sortOrder ?? 0,
  });
  return toView(row);
}

export async function updateChannel(
  id: string,
  fields: Partial<ChannelInput> & { active?: boolean },
): Promise<TelegramChannelView> {
  const existing = await repo.findById(id);
  if (!existing) throw new TelegramError('NOT_FOUND', 'Channel not found', 404);

  const chatId = fields.chatId === undefined ? undefined : normalizeChatId(fields.chatId);
  if (chatId && chatId !== existing.chatId) {
    const clash = await repo.findByChatId(chatId);
    if (clash) throw new TelegramError('DUPLICATE_CHAT_ID', 'That chat is already configured', 409);
  }

  await repo.updateChannel(id, {
    label: fields.label?.trim(),
    chatId,
    purpose: fields.purpose === undefined ? undefined : normalizePurpose(fields.purpose),
    events: fields.events === undefined ? undefined : normalizeEvents(fields.events),
    active: fields.active,
    sortOrder: fields.sortOrder,
  });
  const updated = await repo.findById(id);
  if (!updated) throw new TelegramError('NOT_FOUND', 'Channel not found', 404);
  return toView(updated);
}

export async function deleteChannel(id: string): Promise<void> {
  const existing = await repo.findById(id);
  if (!existing) throw new TelegramError('NOT_FOUND', 'Channel not found', 404);
  await repo.removeChannel(id);
}

/**
 * Fan a formatted message out to every active 'notify' channel subscribed to `event`.
 * A channel with no explicit event list receives everything.
 *
 * Never throws and never awaits the caller's critical path beyond the sends themselves —
 * a Telegram outage must not turn into a failed signup.
 */
export async function notify(event: NotifyEventKey, text: string): Promise<void> {
  if (!client.isConfigured()) return;
  try {
    const channels = await repo.listActiveByPurpose('notify');
    const targets = channels.filter((c) => {
      const subscribed = parseEvents(c.events);
      return subscribed.length === 0 || subscribed.includes(event);
    });
    if (targets.length === 0) return;
    await Promise.all(
      targets.map(async (c) => {
        const result = await client.sendMessage(c.chatId, text);
        if (!result.ok && !result.skipped) {
          logger.warn({ event, chatId: c.chatId, error: result.error }, 'telegram: notify failed');
        }
      }),
    );
  } catch (err) {
    logger.error({ err, event }, 'telegram: notify fan-out failed');
  }
}

/** Admin "send test message" — unlike notify() this surfaces the failure to the caller. */
export async function sendTest(id: string): Promise<void> {
  const channel = await repo.findById(id);
  if (!channel) throw new TelegramError('NOT_FOUND', 'Channel not found', 404);
  if (!client.isConfigured()) {
    throw new TelegramError('NOT_CONFIGURED', 'TELEGRAM_BOT_TOKEN is not set on the server', 503);
  }
  const result = await client.sendMessage(
    channel.chatId,
    `✅ <b>Mentra test message</b>\n\nChannel: ${client.escapeHtml(channel.label)}\n🕐 ${client.nowIST()}`,
  );
  if (!result.ok) {
    // Distinguish "you configured this wrong" from "the network/Telegram is down".
    // A 400/403 from Telegram (chat not found, bot not a member) is a config error the
    // admin can fix here — reporting it as 502 Bad Gateway sends them debugging the
    // proxy instead of reading the message.
    const rejected = result.status === 400 || result.status === 403;
    throw new TelegramError(
      rejected ? 'SEND_REJECTED' : 'SEND_FAILED',
      rejected
        ? `Telegram rejected it: ${result.error ?? 'unknown error'}. Check the chat id, and that the bot was added to the chat as an admin.`
        : (result.error ?? 'Could not reach Telegram'),
      rejected ? 400 : 502,
    );
  }
}

/** Is this chat one of the configured 'smm' channels? Used by the webhook. */
export async function isSmmChannel(chat: { id?: number | string; username?: string }): Promise<boolean> {
  const channels = await repo.listActiveByPurpose('smm');
  if (channels.length === 0) return false;
  const id = chat.id == null ? null : String(chat.id);
  const username = chat.username ? `@${chat.username.toLowerCase()}` : null;
  return channels.some((c) => c.chatId === id || (username !== null && c.chatId.toLowerCase() === username));
}
