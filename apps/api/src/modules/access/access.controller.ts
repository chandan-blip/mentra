import type { Request, Response } from 'express';
import {
  assignUserSchema,
  moduleKeyParamSchema,
  moduleUpsertSchema,
  planUpsertSchema,
  rolePermissionSchema,
  roleUpsertSchema,
} from './access.schema.js';
import {
  adminAssignUser,
  adminDeleteModule,
  adminListModules,
  adminListPlans,
  listPlansForUser,
  adminListRolePermissions,
  adminListRoles,
  adminListUsers,
  adminSaveModule,
  adminSavePlan,
  adminSaveRole,
  adminSetRolePermission,
  getMyAccess,
} from './access.service.js';

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

export async function getMyModules(req: Request, res: Response): Promise<void> {
  res.json({ data: await getMyAccess(req.auth!.sub) });
}

/** Active subscription plans offered to the current user's role. */
export async function getMyPlans(req: Request, res: Response): Promise<void> {
  res.json({ data: await listPlansForUser(req.auth!.sub) });
}

// --- Admin ---

export async function listModules(_req: Request, res: Response): Promise<void> {
  res.json({ data: await adminListModules() });
}
export async function saveModule(req: Request, res: Response): Promise<void> {
  await adminSaveModule(moduleUpsertSchema.parse(req.body));
  res.json({ data: { saved: true } });
}
export async function deleteModule(req: Request, res: Response): Promise<void> {
  const { key } = moduleKeyParamSchema.parse(req.params);
  await adminDeleteModule(key);
  res.json({ data: { deleted: true } });
}

export async function listRoles(_req: Request, res: Response): Promise<void> {
  res.json({ data: await adminListRoles() });
}
export async function saveRole(req: Request, res: Response): Promise<void> {
  await adminSaveRole(roleUpsertSchema.parse(req.body));
  res.json({ data: { saved: true } });
}

export async function listRolePermissions(req: Request, res: Response): Promise<void> {
  res.json({ data: await adminListRolePermissions(str(req.query.roleId) ?? '') });
}
export async function setRolePermission(req: Request, res: Response): Promise<void> {
  await adminSetRolePermission(rolePermissionSchema.parse(req.body));
  res.json({ data: { saved: true } });
}

export async function listPlans(_req: Request, res: Response): Promise<void> {
  res.json({ data: await adminListPlans() });
}
export async function savePlan(req: Request, res: Response): Promise<void> {
  await adminSavePlan(planUpsertSchema.parse(req.body));
  res.json({ data: { saved: true } });
}

export async function listUsers(_req: Request, res: Response): Promise<void> {
  res.json({ data: await adminListUsers() });
}
export async function assignUser(req: Request, res: Response): Promise<void> {
  await adminAssignUser(assignUserSchema.parse(req.body));
  res.json({ data: { saved: true } });
}
