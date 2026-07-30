import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireAdmin } from '../access/access.middleware.js';
import { SmmError } from './smm.errors.js';
import {
  deleteQueueItem,
  getOverview,
  postManualOrder,
  postRetry,
  putConfig,
  putWebhookEnabled,
} from './smm.controller.js';

/**
 * Admin surface — panel config + order queue, mounted under the admin console at
 * /admin/smm. requireAdmin rather than a module permission: these endpoints spend real
 * panel balance and hold the panel API key.
 */
export const smmRouter: Router = Router();
smmRouter.use(requireAuth, requireAdmin);
smmRouter.get('/', asyncHandler(getOverview));
smmRouter.put('/config', asyncHandler(putConfig));
smmRouter.put('/webhook-enabled', asyncHandler(putWebhookEnabled));
smmRouter.post('/orders', asyncHandler(postManualOrder));
smmRouter.post('/queue/:id/retry', asyncHandler(postRetry));
smmRouter.delete('/queue/:id', asyncHandler(deleteQueueItem));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }
      if (err instanceof SmmError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      req.log.error({ err }, 'smm route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
