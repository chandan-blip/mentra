import type { NextFunction, Request, Response } from 'express';
import { getEffectivePermission, getMyAccess, isUserAdmin } from './access.service.js';

/**
 * Gate a route on the user's resolved RBAC role (admins always pass). Use for staff
 * surfaces (e.g. accountant) that aren't plan/module entitlements.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.auth?.sub;
    if (!userId) {
      res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
      return;
    }
    getMyAccess(userId)
      .then((a) => {
        if (a.isAdmin || roles.includes(a.roleId)) return next();
        res.status(403).json({ error: { code: 'ROLE_REQUIRED', message: `Requires role: ${roles.join(', ')}` } });
      })
      .catch((err: unknown) => {
        req.log.error({ err, roles }, 'role check failed');
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
      });
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const userId = req.auth?.sub;
  if (!userId) {
    res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    return;
  }
  isUserAdmin(userId)
    .then((ok) => {
      if (ok) return next();
      res.status(403).json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access required' } });
    })
    .catch((err: unknown) => {
      req.log.error({ err }, 'admin check failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
}

/** Gate a route on a module permission. Plan must include the module AND the role must grant the action. */
export function requirePermission(moduleKey: string, action: 'read' | 'write') {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.auth?.sub;
    if (!userId) {
      res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
      return;
    }
    getEffectivePermission(userId, moduleKey)
      .then((p) => {
        const allowed = action === 'write' ? p.canWrite && p.unlocked : p.canRead && p.unlocked;
        if (allowed) return next();
        res.status(403).json({
          error: { code: 'PERMISSION_DENIED', message: `No ${action} access to ${moduleKey}` },
        });
      })
      .catch((err: unknown) => {
        req.log.error({ err, moduleKey }, 'permission check failed');
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
      });
  };
}
