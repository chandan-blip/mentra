import type { Request, Response } from 'express';
import { z } from 'zod';
import * as svc from './smm.service.js';

const configSchema = z.object({
  enabled: z.boolean().optional(),
  apiUrl: z.string().trim().max(500).optional(),
  // Blank/omitted keeps the stored key — the UI never receives it back, so an untouched
  // form must not clear the credential.
  apiKey: z.string().trim().max(500).optional(),
  viewsEnabled: z.boolean().optional(),
  viewsServiceId: z.string().trim().max(64).optional(),
  viewsQuantity: z.number().int().min(0).max(1_000_000).optional(),
  reactionsEnabled: z.boolean().optional(),
  reactionsServiceId: z.string().trim().max(64).optional(),
  reactionsQuantity: z.number().int().min(0).max(1_000_000).optional(),
});

const webhookSchema = z.object({ enabled: z.boolean() });
const manualSchema = z.object({ postUrl: z.string().trim().min(1).max(500) });

function id(req: Request): string {
  return String(req.params.id);
}

export async function getOverview(req: Request, res: Response): Promise<void> {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const [config, webhookEnabled, queue] = await Promise.all([
    svc.getRedactedConfig(),
    svc.isWebhookEnabled(),
    svc.listQueue(Number.isFinite(limit) ? limit : undefined),
  ]);
  res.json({ data: { config, webhookEnabled, queue: queue.items, counts: queue.counts } });
}

export async function putConfig(req: Request, res: Response): Promise<void> {
  await svc.saveConfig(configSchema.parse(req.body ?? {}));
  res.json({ data: await svc.getRedactedConfig() });
}

export async function putWebhookEnabled(req: Request, res: Response): Promise<void> {
  const { enabled } = webhookSchema.parse(req.body ?? {});
  await svc.setWebhookEnabled(enabled);
  res.json({ data: { enabled } });
}

export async function postManualOrder(req: Request, res: Response): Promise<void> {
  const { postUrl } = manualSchema.parse(req.body ?? {});
  res.status(202).json({ data: await svc.enqueueManual(postUrl) });
}

export async function postRetry(req: Request, res: Response): Promise<void> {
  await svc.retryQueueItem(id(req));
  res.json({ data: { retried: true } });
}

export async function deleteQueueItem(req: Request, res: Response): Promise<void> {
  await svc.deleteQueueItem(id(req));
  res.status(204).end();
}
