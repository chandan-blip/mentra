import { env } from '../../env.js';
import { logger } from '../../logger.js';

/**
 * Thin Telegram Bot API client. One bot token (env) serves every configured channel.
 *
 * Every call is best-effort by design: notifications ride on user actions (signup,
 * enquiry, support message) and must never fail or delay them. Errors are logged and
 * returned as a result object rather than thrown.
 */
const API = 'https://api.telegram.org';

export type SendResult = { ok: boolean; skipped?: boolean; status?: number; error?: string };

export function isConfigured(): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN);
}

/** Escape for Telegram's HTML parse_mode — only these four are special. */
export function escapeHtml(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** IST timestamp — the team reads these in local time, not UTC. */
export function nowIST(): string {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

async function call(method: string, body: unknown): Promise<SendResult> {
  if (!isConfigured()) return { ok: false, skipped: true, error: 'TELEGRAM_BOT_TOKEN unset' };
  try {
    const res = await fetch(`${API}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = await res.text();
      // Telegram puts the human-readable reason in `description` ("Bad Request: chat not
      // found", "Forbidden: bot is not a member of the channel chat"). Surfacing the raw
      // JSON instead would bury the one part an admin can act on. Truncated either way:
      // Telegram echoes the request back on some errors, token included.
      let reason = text.slice(0, 200);
      try {
        const parsed = JSON.parse(text) as { description?: string };
        if (parsed.description) reason = parsed.description;
      } catch {
        /* non-JSON body — keep the truncated text */
      }
      logger.error({ method, status: res.status, reason }, 'telegram: api error');
      return { ok: false, status: res.status, error: reason };
    }
    return { ok: true };
  } catch (err) {
    // undici collapses every transport problem into a bare "fetch failed" and hides the
    // real reason in err.cause — ENOTFOUND (DNS), ECONNREFUSED/ETIMEDOUT (no route or
    // blocked egress), or a TLS failure. Without this the admin sees "fetch failed" and
    // has nothing to act on.
    const message = err instanceof Error ? err.message : String(err);
    const cause = (err as { cause?: { code?: string; message?: string } }).cause;
    const detail = cause?.code ?? cause?.message;
    logger.error({ err, method, cause: detail }, 'telegram: request failed');
    return { ok: false, error: detail ? `${message} (${detail})` : message };
  }
}

/** Send an HTML message to one chat. `chatId` is a -100… id or an @publicname. */
export function sendMessage(chatId: string, text: string): Promise<SendResult> {
  return call('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });
}
