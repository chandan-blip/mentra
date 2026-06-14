import { Router, type Request, type Response } from 'express';
import { receiveWebhook } from '../../core/livekit.js';
import { handleWebhookEvent } from './live-session.service.js';

/**
 * LiveKit webhook receiver. Mounted in app.ts with `express.raw(...)` BEFORE the
 * global `express.json` so we get the raw body needed for HMAC verification.
 * No auth middleware — LiveKit authenticates via the signed Authorization header.
 */
export const liveSessionWebhookRouter: Router = Router();

liveSessionWebhookRouter.post('/', (req: Request, res: Response) => {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  receiveWebhook(raw, req.get('Authorization'))
    .then(async (event) => {
      await handleWebhookEvent(event);
      res.status(200).json({ ok: true });
    })
    .catch((err: unknown) => {
      req.log.warn({ err }, 'livekit webhook rejected');
      res.status(401).json({ error: { code: 'WEBHOOK_INVALID', message: 'Invalid webhook signature' } });
    });
});
