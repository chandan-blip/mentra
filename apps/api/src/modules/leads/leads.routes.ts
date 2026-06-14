import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { env } from '../../env.js';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireRole } from '../access/access.middleware.js';
import { LeadError } from './leads.errors.js';
import { MARKETING_ROLE, handleVapiWebhook } from './leads.service.js';
import {
  deleteLeadHandler,
  deleteListHandler,
  getCalls,
  getLead,
  getLeads,
  getListMembers,
  getLists,
  patchLead,
  patchList,
  postAddMembers,
  postLead,
  postLeadCall,
  postList,
  postRemoveMembers,
  postSendEmail,
  postStartCall,
} from './leads.controller.js';

/**
 * Public Vapi webhook (no auth — it's a server-to-server callback). Mounted BEFORE
 * the gated router. Optionally verifies the X-Vapi-Secret header against env.
 */
export const leadsVapiWebhookRouter: Router = Router();
leadsVapiWebhookRouter.post('/vapi/webhook', (req: Request, res: Response) => {
  if (env.VAPI_WEBHOOK_SECRET && req.get('x-vapi-secret') !== env.VAPI_WEBHOOK_SECRET) {
    res.status(401).json({ error: { code: 'BAD_SECRET', message: 'Invalid webhook secret' } });
    return;
  }
  handleVapiWebhook(req.body ?? {})
    .then(() => res.json({ ok: true }))
    .catch((err: unknown) => {
      req.log.error({ err }, 'vapi webhook failed');
      // Ack anyway so Vapi doesn't hammer retries on a transient store error.
      res.json({ ok: false });
    });
});

export const leadsRouter: Router = Router();

leadsRouter.use(requireAuth);
leadsRouter.use(requireRole(MARKETING_ROLE));

// Leads CRUD
leadsRouter.get('/', asyncHandler(getLeads));
leadsRouter.post('/', asyncHandler(postLead));
leadsRouter.patch('/:id', asyncHandler(patchLead));
leadsRouter.delete('/:id', asyncHandler(deleteLeadHandler));
// Single-lead AI call (place one call to this lead, no list).
leadsRouter.post('/:id/call', asyncHandler(postLeadCall));

// Lists (static path segment, registered before /:id-style lead routes is unnecessary
// since these live under /lists/*, a distinct prefix)
leadsRouter.get('/lists', asyncHandler(getLists));
leadsRouter.post('/lists', asyncHandler(postList));
leadsRouter.patch('/lists/:id', asyncHandler(patchList));
leadsRouter.delete('/lists/:id', asyncHandler(deleteListHandler));
leadsRouter.get('/lists/:id/members', asyncHandler(getListMembers));
leadsRouter.post('/lists/:id/members', asyncHandler(postAddMembers));
leadsRouter.delete('/lists/:id/members', asyncHandler(postRemoveMembers));

// List actions
leadsRouter.post('/lists/:id/call', asyncHandler(postStartCall));
leadsRouter.post('/lists/:id/email', asyncHandler(postSendEmail));

// Calls
leadsRouter.get('/calls', asyncHandler(getCalls));

// Single lead fetch — registered LAST so '/lists' and '/calls' match first
// (a bare '/:id' would otherwise shadow those static GET paths).
leadsRouter.get('/:id', asyncHandler(getLead));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() } });
        return;
      }
      if (err instanceof LeadError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      req.log.error({ err }, 'leads route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
