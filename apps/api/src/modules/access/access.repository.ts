import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../../db.js';

export type ModuleRow = {
  key: string;
  label: string;
  description: string | null;
  icon: string | null;
  route: string | null;
  placement: string;
  role: string | null;
  parentKey: string | null;
  sortOrder: number;
  active: 0 | 1 | boolean;
};

export type RoleRow = {
  id: string;
  label: string;
  description: string | null;
  isAdmin: 0 | 1 | boolean;
  isSystem: 0 | 1 | boolean;
};

export type RolePermissionRow = {
  roleId: string;
  moduleKey: string;
  canRead: 0 | 1 | boolean;
  canWrite: 0 | 1 | boolean;
};

export type PlanRow = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  active: 0 | 1 | boolean;
  isDefault: 0 | 1 | boolean;
  roleId: string | null;
};

export type UserAccessRow = {
  id: string;
  role: string;
  roleId: string | null;
  planId: string | null;
};

const MODULE_COLS =
  '`key`, `label`, `description`, `icon`, `route`, `placement`, `role`, `parentKey`, `sortOrder`, `active`';

export async function listModules(activeOnly = true): Promise<ModuleRow[]> {
  const where = activeOnly ? 'WHERE `active` = true' : '';
  const [rows] = await db.execute<(ModuleRow & RowDataPacket)[]>(
    `SELECT ${MODULE_COLS} FROM \`Module\` ${where} ORDER BY \`sortOrder\`, \`label\``,
  );
  return rows;
}

export async function listRoles(): Promise<RoleRow[]> {
  const [rows] = await db.execute<(RoleRow & RowDataPacket)[]>(
    'SELECT `id`, `label`, `description`, `isAdmin`, `isSystem` FROM `Role` ORDER BY `isSystem` DESC, `label`',
  );
  return rows;
}

export async function findRole(roleId: string): Promise<RoleRow | null> {
  const [rows] = await db.execute<(RoleRow & RowDataPacket)[]>(
    'SELECT `id`, `label`, `description`, `isAdmin`, `isSystem` FROM `Role` WHERE `id` = :roleId LIMIT 1',
    { roleId },
  );
  return rows[0] ?? null;
}

export async function listRolePermissions(roleId: string): Promise<RolePermissionRow[]> {
  const [rows] = await db.execute<(RolePermissionRow & RowDataPacket)[]>(
    'SELECT `roleId`, `moduleKey`, `canRead`, `canWrite` FROM `RolePermission` WHERE `roleId` = :roleId',
    { roleId },
  );
  return rows;
}

export async function listPlans(): Promise<PlanRow[]> {
  const [rows] = await db.execute<(PlanRow & RowDataPacket)[]>(
    'SELECT `id`, `name`, `description`, `priceCents`, `active`, `isDefault`, `roleId` FROM `Plan` ORDER BY `priceCents`',
  );
  return rows;
}

export async function getDefaultPlanId(): Promise<string | null> {
  const [rows] = await db.execute<(RowDataPacket & { id: string })[]>(
    'SELECT `id` FROM `Plan` WHERE `isDefault` = true AND `active` = true LIMIT 1',
  );
  return rows[0]?.id ?? null;
}

export async function listPlanModuleKeys(planId: string): Promise<string[]> {
  const [rows] = await db.execute<(RowDataPacket & { moduleKey: string })[]>(
    'SELECT `moduleKey` FROM `PlanModule` WHERE `planId` = :planId',
    { planId },
  );
  return rows.map((r) => r.moduleKey);
}

export async function findUserAccess(userId: string): Promise<UserAccessRow | null> {
  const [rows] = await db.execute<(UserAccessRow & RowDataPacket)[]>(
    'SELECT `id`, `role`, `roleId`, `planId` FROM `User` WHERE `id` = :userId LIMIT 1',
    { userId },
  );
  return rows[0] ?? null;
}

// --- Admin writes ---

export async function upsertModule(input: ModuleRow): Promise<void> {
  await db.execute<ResultSetHeader>(
    'INSERT INTO `Module` (`key`, `label`, `description`, `icon`, `route`, `placement`, `role`, `parentKey`, `sortOrder`, `active`) ' +
      'VALUES (:key, :label, :description, :icon, :route, :placement, :role, :parentKey, :sortOrder, :active) ' +
      'ON DUPLICATE KEY UPDATE `label`=:label, `description`=:description, `icon`=:icon, `route`=:route, ' +
      '`placement`=:placement, `role`=:role, `parentKey`=:parentKey, `sortOrder`=:sortOrder, `active`=:active',
    {
      key: input.key,
      label: input.label,
      description: input.description,
      icon: input.icon,
      route: input.route,
      placement: input.placement,
      role: input.role,
      parentKey: input.parentKey,
      sortOrder: input.sortOrder,
      active: input.active === true || input.active === 1,
    },
  );
}

export async function findModule(key: string): Promise<ModuleRow | null> {
  const [rows] = await db.execute<(ModuleRow & RowDataPacket)[]>(
    `SELECT ${MODULE_COLS} FROM \`Module\` WHERE \`key\` = :key LIMIT 1`,
    { key },
  );
  return rows[0] ?? null;
}

export async function listChildModuleKeys(parentKey: string): Promise<string[]> {
  const [rows] = await db.execute<(RowDataPacket & { key: string })[]>(
    'SELECT `key` FROM `Module` WHERE `parentKey` = :parentKey',
    { parentKey },
  );
  return rows.map((r) => r.key);
}

/**
 * Delete a module and the join rows that reference it. There are no FK constraints
 * (see project convention), so role-permission and plan-module rows are cleaned up
 * explicitly in a transaction to avoid dangling references.
 */
export async function deleteModule(key: string): Promise<void> {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM `RolePermission` WHERE `moduleKey` = ?', [key]);
    await conn.execute('DELETE FROM `PlanModule` WHERE `moduleKey` = ?', [key]);
    await conn.execute('DELETE FROM `Module` WHERE `key` = ?', [key]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function upsertRole(input: {
  id: string;
  label: string;
  description: string | null;
  isAdmin: boolean;
}): Promise<void> {
  await db.execute<ResultSetHeader>(
    'INSERT INTO `Role` (`id`, `label`, `description`, `isAdmin`) VALUES (:id, :label, :description, :isAdmin) ' +
      'ON DUPLICATE KEY UPDATE `label`=:label, `description`=:description, `isAdmin`=:isAdmin',
    input,
  );
}

export async function setRolePermission(input: {
  roleId: string;
  moduleKey: string;
  canRead: boolean;
  canWrite: boolean;
}): Promise<void> {
  await db.execute<ResultSetHeader>(
    'INSERT INTO `RolePermission` (`roleId`, `moduleKey`, `canRead`, `canWrite`) ' +
      'VALUES (:roleId, :moduleKey, :canRead, :canWrite) ' +
      'ON DUPLICATE KEY UPDATE `canRead`=:canRead, `canWrite`=:canWrite',
    input,
  );
}

export async function upsertPlan(input: {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  active: boolean;
  isDefault: boolean;
  roleId: string | null;
}): Promise<void> {
  await db.execute<ResultSetHeader>(
    'INSERT INTO `Plan` (`id`, `name`, `description`, `priceCents`, `active`, `isDefault`, `roleId`) ' +
      'VALUES (:id, :name, :description, :priceCents, :active, :isDefault, :roleId) ' +
      'ON DUPLICATE KEY UPDATE `name`=:name, `description`=:description, `priceCents`=:priceCents, ' +
      '`active`=:active, `isDefault`=:isDefault, `roleId`=:roleId',
    input,
  );
}

/** Keep the default flag a singleton — clear it on every plan except the given one. */
export async function clearDefaultPlanExcept(planId: string): Promise<void> {
  await db.execute<ResultSetHeader>('UPDATE `Plan` SET `isDefault` = false WHERE `id` <> :planId', {
    planId,
  });
}

/** Assign a plan to a user only if they have none yet (used to seed the default at signup). */
export async function assignPlanIfUnset(userId: string, planId: string): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `User` SET `planId` = :planId WHERE `id` = :userId AND `planId` IS NULL',
    { userId, planId },
  );
}

export async function setPlanModules(planId: string, moduleKeys: string[]): Promise<void> {
  await db.execute<ResultSetHeader>('DELETE FROM `PlanModule` WHERE `planId` = :planId', { planId });
  for (const moduleKey of moduleKeys) {
    await db.execute<ResultSetHeader>(
      'INSERT INTO `PlanModule` (`planId`, `moduleKey`) VALUES (:planId, :moduleKey)',
      { planId, moduleKey },
    );
  }
}

export async function setUserRoleAndPlan(input: {
  userId: string;
  roleId: string | null;
  planId: string | null;
}): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `User` SET `roleId` = :roleId, `planId` = :planId WHERE `id` = :userId',
    input,
  );
}

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  roleId: string | null;
  planId: string | null;
  createdAt: Date;
};

export async function listUsers(limit = 100): Promise<AdminUserRow[]> {
  const [rows] = await db.execute<(AdminUserRow & RowDataPacket)[]>(
    'SELECT `id`, `email`, `name`, `role`, `roleId`, `planId`, `createdAt` FROM `User` ORDER BY `createdAt` DESC LIMIT ' +
      Number(limit),
  );
  return rows;
}
