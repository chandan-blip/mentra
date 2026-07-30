import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireAdmin } from '../access/access.middleware.js';
import { TelegramError } from './telegram.errors.js';
import {
  deleteChannel,
  getOverview,
  patchChannel,
  postChannel,
  postTest,
  postWebhook,
} from './telegram.controller.js';

/**
 * Telegram callbacks. Unauthenticated by design — Telegram cannot present a JWT — and
 * verified instead by the secret token echoed in a header (see postWebhook).
 * Mounted at /api/v1/telegram.
 */
export const telegramWebhookRouter: Router = Router();
telegramWebhookRouter.post('/webhook', asyncHandler(postWebhook));

/**
 * Admin surface — the channel registry, mounted under the admin console at
 * /admin/telegram. Gated with requireAdmin (not a module permission) to match that
 * shell: these settings decide where private user data gets broadcast, so they are not
 * something a plan entitlement should ever unlock.
 */
export const telegramRouter: Router = Router();
telegramRouter.use(requireAuth, requireAdmin);
telegramRouter.get('/', asyncHandler(getOverview));
telegramRouter.post('/channels', asyncHandler(postChannel));
telegramRouter.patch('/channels/:id', asyncHandler(patchChannel));
telegramRouter.delete('/channels/:id', asyncHandler(deleteChannel));
telegramRouter.post('/channels/:id/test', asyncHandler(postTest));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }
      if (err instanceof TelegramError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      req.log.error({ err }, 'telegram route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
