import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AdminSettings } from '@mentra/shared';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireAdmin } from './access.middleware.js';
import { AccessError } from './access.service.js';
import { isEnabled, setEnabled, RECORD_LIVE_SESSIONS_FLAG } from '../feature-flags/feature-flags.service.js';
import {
  assignUser,
  deleteModule,
  getMyModules,
  getMyPlans,
  listModules,
  listPlans,
  listRolePermissions,
  listRoles,
  listUsers,
  saveModule,
  savePlan,
  saveRole,
  setRolePermission,
} from './access.controller.js';

// Mounted at /api/v1/me — the current user's entitlements.
export const meRouter: Router = Router();
meRouter.use(requireAuth);
meRouter.get('/modules', asyncHandler(getMyModules));
meRouter.get('/plans', asyncHandler(getMyPlans));

// Mounted at /api/v1/admin — RBAC + subscription management (admin only).
export const adminRouter: Router = Router();
adminRouter.use(requireAuth, requireAdmin);
adminRouter.get('/modules', asyncHandler(listModules));
adminRouter.post('/modules', asyncHandler(saveModule));
adminRouter.delete('/modules/:key', asyncHandler(deleteModule));
adminRouter.get('/roles', asyncHandler(listRoles));
adminRouter.post('/roles', asyncHandler(saveRole));
adminRouter.get('/role-permissions', asyncHandler(listRolePermissions));
adminRouter.post('/role-permissions', asyncHandler(setRolePermission));
adminRouter.get('/plans', asyncHandler(listPlans));
adminRouter.post('/plans', asyncHandler(savePlan));
adminRouter.get('/users', asyncHandler(listUsers));
adminRouter.post('/users/assign', asyncHandler(assignUser));

// Global platform settings (admin-settings). Backed by feature flags.
adminRouter.get('/settings', asyncHandler(getSettings));
adminRouter.put('/settings', asyncHandler(updateSettings));

async function loadSettings(): Promise<AdminSettings> {
  return { recordLiveSessions: await isEnabled(RECORD_LIVE_SESSIONS_FLAG) };
}

async function getSettings(_req: Request, res: Response): Promise<void> {
  res.json({ data: await loadSettings() });
}

const updateSettingsSchema = z.object({ recordLiveSessions: z.boolean().optional() });

async function updateSettings(req: Request, res: Response): Promise<void> {
  const patch = updateSettingsSchema.parse(req.body ?? {});
  if (patch.recordLiveSessions !== undefined) {
    await setEnabled(RECORD_LIVE_SESSIONS_FLAG, patch.recordLiveSessions);
  }
  res.json({ data: await loadSettings() });
}

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }
      if (err instanceof AccessError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      req.log.error({ err }, 'access route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
