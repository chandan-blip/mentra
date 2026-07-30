import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../env.js';
import { enqueue, isWebhookEnabled } from '../smm/smm.service.js';
import * as svc from './telegram.service.js';
import { isConfigured } from './telegram.client.js';

const channelSchema = z.object({
  label: z.string().trim().min(1).max(120),
  chatId: z.string().trim().min(1).max(120),
  purpose: z.enum(['notify', 'smm']).optional(),
  events: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
});

const patchSchema = channelSchema.partial().extend({ active: z.boolean().optional() });

function id(req: Request): string {
  return String(req.params.id);
}

/** Config + catalogue the admin UI needs to render the page. */
export async function getOverview(_req: Request, res: Response): Promise<void> {
  res.json({
    data: {
      botConfigured: isConfigured(),
      webhookSecretSet: Boolean(env.TELEGRAM_WEBHOOK_SECRET),
      webhookUrl: `${env.WEB_APP_ORIGIN.replace(/\/+$/, '')}/api/v1/telegram/webhook`,
      events: svc.NOTIFY_EVENTS,
      channels: await svc.listChannels(),
    },
  });
}

export async function postChannel(req: Request, res: Response): Promise<void> {
  res.status(201).json({ data: await svc.createChannel(channelSchema.parse(req.body ?? {})) });
}

export async function patchChannel(req: Request, res: Response): Promise<void> {
  res.json({ data: await svc.updateChannel(id(req), patchSchema.parse(req.body ?? {})) });
}

export async function deleteChannel(req: Request, res: Response): Promise<void> {
  await svc.deleteChannel(id(req));
  res.status(204).end();
}

export async function postTest(req: Request, res: Response): Promise<void> {
  await svc.sendTest(id(req));
  res.json({ data: { sent: true } });
}

/**
 * Telegram webhook. Detects posts made directly in a configured 'smm' channel and
 * enqueues an SMM order for each.
 *
 * No auth middleware and no rate limiter: this is a server-to-server call from Telegram.
 * Authenticity rests entirely on the secret token we set via setWebhook, which Telegram
 * echoes in X-Telegram-Bot-Api-Secret-Token. An unset secret rejects everything rather
 * than falling open — otherwise anyone who guessed the path could queue paid orders.
 *
 * Always answers 200 to an authenticated call, even on internal failure: a non-2xx makes
 * Telegram retry the same update for hours.
 */
export async function postWebhook(req: Request, res: Response): Promise<void> {
  const expected = env.TELEGRAM_WEBHOOK_SECRET;
  const provided = req.get('X-Telegram-Bot-Api-Secret-Token') ?? '';
  if (!expected || provided !== expected) {
    res.status(401).json({ ok: false });
    return;
  }

  const update = (req.body ?? {}) as {
    channel_post?: { message_id?: number; chat?: { id?: number; username?: string } };
  };
  const post = update.channel_post; // ignore edits, DMs and group messages

  try {
    if (post?.chat && (await svc.isSmmChannel(post.chat))) {
      const postUrl = buildPostUrl(post.chat, post.message_id);
      if (postUrl) {
        if (!(await isWebhookEnabled())) {
          req.log.info({ postUrl }, 'telegram webhook: SMM master switch off, skipped');
        } else {
          const queueId = await enqueue(postUrl, 'webhook:channel_post');
          req.log.info({ postUrl, queueId }, queueId ? 'telegram webhook: enqueued' : 'telegram webhook: duplicate');
        }
      }
    }
  } catch (err) {
    req.log.error({ err }, 'telegram webhook: handler failed');
  }
  res.json({ ok: true });
}

/**
 * Public channels get a /<username>/<id> link; private ones only have the numeric id,
 * whose t.me form drops the -100 prefix. Must match whatever a producer would build, or
 * the postUrl uniqueness that prevents double orders stops working.
 */
function buildPostUrl(chat: { id?: number; username?: string }, messageId: number | undefined): string | null {
  if (!messageId) return null;
  if (chat.username) return `https://t.me/${chat.username}/${messageId}`;
  if (chat.id != null) return `https://t.me/c/${String(chat.id).replace(/^-100/, '')}/${messageId}`;
  return null;
}
