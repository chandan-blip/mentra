import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireRole } from '../access/access.middleware.js';
import {
  deleteConnect,
  getAuthUrl,
  getConnections,
  getPosts,
  linkedinCallback,
  postConnect,
  postPost,
  postSync,
} from './marketing.controller.js';
import { MARKETING_ROLE } from './marketing.service.js';
import { MarketingError } from './marketing.errors.js';

/** Public OAuth callback (no auth — it's a top-level browser redirect). Mount BEFORE the gated router. */
export const marketingOauthRouter: Router = Router();
marketingOauthRouter.get('/linkedin/callback', (req, res) => {
  void linkedinCallback(req, res);
});

export const marketingRouter: Router = Router();

marketingRouter.use(requireAuth);
marketingRouter.use(requireRole(MARKETING_ROLE));

marketingRouter.get('/connections', asyncHandler(getConnections));
marketingRouter.post('/connections', asyncHandler(postConnect));
marketingRouter.delete('/connections/:channel', asyncHandler(deleteConnect));
marketingRouter.get('/posts', asyncHandler(getPosts));
marketingRouter.post('/posts', asyncHandler(postPost));
marketingRouter.get('/linkedin/auth-url', asyncHandler(getAuthUrl));
marketingRouter.post('/linkedin/sync', asyncHandler(postSync));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() } });
        return;
      }
      if (err instanceof MarketingError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      req.log.error({ err }, 'marketing route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
