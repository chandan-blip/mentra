import type {
  AdminModule,
  AdminPlan,
  AdminRole,
  AdminRolePermission,
  AdminUser,
  MeAccess,
  ModuleEntitlement,
  ModulePlacement,
} from '@mentra/shared';
import {
  type ModuleRow,
  deleteModule,
  findModule,
  findRole,
  findUserAccess,
  getDefaultPlanId,
  listChildModuleKeys,
  listModules,
  listPlanModuleKeys,
  listPlans,
  listRolePermissions,
  listRoles,
  listUsers,
  setPlanModules,
  setRolePermission,
  setUserRoleAndPlan,
  upsertModule,
  upsertPlan,
  upsertRole,
} from './access.repository.js';

export class AccessError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

const bool = (v: 0 | 1 | boolean): boolean => v === true || v === 1;

const placementOf = (v: string): ModulePlacement => (v === 'other' ? 'other' : 'sidebar');

const DEFAULT_ROLE_ID = 'student';

type ResolvedRole = { roleId: string; isAdmin: boolean; planId: string | null };

async function resolveUserRole(userId: string): Promise<ResolvedRole> {
  const ua = await findUserAccess(userId);
  if (!ua) throw new AccessError('USER_NOT_FOUND', 'User not found', 404);

  const roleId = ua.roleId ?? ua.role ?? DEFAULT_ROLE_ID;
  const role = (await findRole(roleId)) ?? (await findRole(ua.role));
  const isAdmin = role ? bool(role.isAdmin) : ua.role === 'admin';
  return { roleId: role?.id ?? roleId, isAdmin, planId: ua.planId };
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  return (await resolveUserRole(userId)).isAdmin;
}

/**
 * True if the user holds a Mentra subscription — i.e. their assigned plan is a
 * non-default (paid) plan. Used to gate "casual" subscriber-only mentor sessions.
 */
export async function isSubscribed(userId: string): Promise<boolean> {
  const ua = await findUserAccess(userId);
  if (!ua?.planId) return false;
  const defaultPlanId = await getDefaultPlanId();
  return ua.planId !== defaultPlanId;
}

function toEntitlement(
  m: ModuleRow,
  canRead: boolean,
  canWrite: boolean,
  unlocked: boolean,
): ModuleEntitlement {
  return {
    key: m.key,
    label: m.label,
    description: m.description,
    icon: m.icon,
    route: m.route,
    parentKey: m.parentKey,
    placement: placementOf(m.placement),
    sortOrder: m.sortOrder,
    canRead,
    canWrite,
    unlocked,
  };
}

export async function getMyAccess(userId: string): Promise<MeAccess> {
  const { roleId, isAdmin, planId } = await resolveUserRole(userId);
  const modules = await listModules(true);

  // Admins have implicit full access: every active module, with read + write and
  // no plan-gating — no RolePermission or PlanModule rows required.
  if (isAdmin) {
    return { roleId, isAdmin, planId, modules: modules.map((m) => toEntitlement(m, true, true, true)) };
  }

  const perms = new Map((await listRolePermissions(roleId)).map((p) => [p.moduleKey, p]));
  const effectivePlanId = planId ?? (await getDefaultPlanId());
  const planModules = new Set(effectivePlanId ? await listPlanModuleKeys(effectivePlanId) : []);

  const visible: ModuleEntitlement[] = [];
  for (const m of modules) {
    const p = perms.get(m.key);
    if (!p || !bool(p.canRead)) continue; // role can't read → not visible
    visible.push(toEntitlement(m, true, bool(p.canWrite), planModules.has(m.key)));
  }

  return { roleId, isAdmin, planId: effectivePlanId, modules: visible };
}

/** Resolve a single module permission for middleware. Admin always passes. */
export async function getEffectivePermission(
  userId: string,
  moduleKey: string,
): Promise<{ canRead: boolean; canWrite: boolean; unlocked: boolean }> {
  const access = await getMyAccess(userId);
  if (access.isAdmin) return { canRead: true, canWrite: true, unlocked: true };
  const m = access.modules.find((x) => x.key === moduleKey);
  return { canRead: Boolean(m?.canRead), canWrite: Boolean(m?.canWrite), unlocked: Boolean(m?.unlocked) };
}

// --- Admin operations ---

export async function adminListModules(): Promise<AdminModule[]> {
  return (await listModules(false)).map((m) => ({
    key: m.key,
    label: m.label,
    description: m.description,
    icon: m.icon,
    route: m.route,
    parentKey: m.parentKey,
    placement: placementOf(m.placement),
    role: m.role,
    sortOrder: m.sortOrder,
    active: bool(m.active),
  }));
}

export async function adminSaveModule(input: AdminModule): Promise<void> {
  await upsertModule({ ...input, active: input.active });
}

export async function adminDeleteModule(key: string): Promise<void> {
  const mod = await findModule(key);
  if (!mod) throw new AccessError('MODULE_NOT_FOUND', 'Module not found', 404);
  const children = await listChildModuleKeys(key);
  if (children.length > 0) {
    throw new AccessError(
      'MODULE_HAS_CHILDREN',
      `Delete or reparent its sub-modules first (${children.join(', ')})`,
      409,
    );
  }
  await deleteModule(key);
}

export async function adminListRoles(): Promise<AdminRole[]> {
  return (await listRoles()).map((r) => ({
    id: r.id,
    label: r.label,
    description: r.description,
    isAdmin: bool(r.isAdmin),
    isSystem: bool(r.isSystem),
  }));
}

export async function adminSaveRole(input: {
  id: string;
  label: string;
  description: string | null;
  isAdmin: boolean;
}): Promise<void> {
  await upsertRole(input);
}

export async function adminListRolePermissions(roleId: string): Promise<AdminRolePermission[]> {
  return (await listRolePermissions(roleId)).map((p) => ({
    roleId: p.roleId,
    moduleKey: p.moduleKey,
    canRead: bool(p.canRead),
    canWrite: bool(p.canWrite),
  }));
}

export async function adminSetRolePermission(input: {
  roleId: string;
  moduleKey: string;
  canRead: boolean;
  canWrite: boolean;
}): Promise<void> {
  const role = await findRole(input.roleId);
  if (!role) throw new AccessError('ROLE_NOT_FOUND', 'Role not found', 404);
  await setRolePermission(input);
}

export async function adminListPlans(): Promise<AdminPlan[]> {
  const plans = await listPlans();
  return Promise.all(
    plans.map(async (p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      priceCents: p.priceCents,
      active: bool(p.active),
      isDefault: bool(p.isDefault),
      roleId: p.roleId ?? null,
      moduleKeys: await listPlanModuleKeys(p.id),
    })),
  );
}

/**
 * Active plans offered to a given user: those with no target role (available to
 * everyone) plus those whose target role matches the user's resolved role. Admins
 * see every active plan.
 */
export async function listPlansForUser(userId: string): Promise<AdminPlan[]> {
  const { roleId, isAdmin } = await resolveUserRole(userId);
  const plans = (await adminListPlans()).filter((p) => p.active);
  if (isAdmin) return plans;
  return plans.filter((p) => !p.roleId || p.roleId === roleId);
}

export async function adminSavePlan(input: {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  active: boolean;
  roleId: string | null;
  moduleKeys: string[];
}): Promise<void> {
  if (input.roleId && !(await findRole(input.roleId))) {
    throw new AccessError('ROLE_NOT_FOUND', 'Target role not found', 404);
  }
  await upsertPlan({
    id: input.id,
    name: input.name,
    description: input.description,
    priceCents: input.priceCents,
    active: input.active,
    roleId: input.roleId,
  });
  await setPlanModules(input.id, input.moduleKeys);
}

export async function adminListUsers(): Promise<AdminUser[]> {
  return (await listUsers()).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    roleId: u.roleId,
    planId: u.planId,
    createdAt: new Date(u.createdAt).toISOString(),
  }));
}

export async function adminAssignUser(input: {
  userId: string;
  roleId: string | null;
  planId: string | null;
}): Promise<void> {
  if (input.roleId && !(await findRole(input.roleId))) {
    throw new AccessError('ROLE_NOT_FOUND', 'Role not found', 404);
  }
  await setUserRoleAndPlan(input);
}
