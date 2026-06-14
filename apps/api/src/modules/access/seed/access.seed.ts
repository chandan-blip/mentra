import type { ResultSetHeader } from 'mysql2';
import { db } from '../../../db.js';
import { logger } from '../../../logger.js';

/**
 * Bootstraps only the core RBAC catalogue: the role list and the default plan.
 * Modules and role permissions are seeded in feature.seed.ts (or managed in the
 * admin UI). The seed never deletes anything, so admin-managed config is the
 * source of truth and survives reseeds.
 */

// The role catalogue is core RBAC infrastructure (the admin assigns these).
type SeedRole = { id: string; label: string; isAdmin?: boolean; isSystem?: boolean };
export const SEED_ROLES: SeedRole[] = [
  { id: 'admin', label: 'Admin', isAdmin: true, isSystem: true },
  { id: 'student', label: 'Student', isSystem: true },
  { id: 'mentor', label: 'Mentor', isSystem: true },
  { id: 'support', label: 'Support' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'accountant', label: 'Accountant' },
  { id: 'hr', label: 'HR' },
];

// Admins have implicit full access (isAdmin), and every other role's permissions
// are managed in the admin UI — so the seed asserts no RolePermission rows.
type Perm = [string, string, boolean, boolean];
export const SEED_PERMISSIONS: Perm[] = [];

// Only the default plan is bootstrapped, so new users always have a fallback plan.
// Its module contents (and any other plans) are managed in the Subscriptions admin.
type SeedPlan = { id: string; name: string; description: string; isDefault?: boolean; modules: string[] };
export const SEED_PLANS: SeedPlan[] = [
  { id: 'free', name: 'Free', description: 'Default plan.', isDefault: true, modules: [] },
];

export async function seedAccess(): Promise<void> {
  for (const r of SEED_ROLES) {
    await db.execute<ResultSetHeader>(
      'INSERT INTO `Role` (`id`, `label`, `isAdmin`, `isSystem`) VALUES (:id, :label, :isAdmin, :isSystem) ' +
        'ON DUPLICATE KEY UPDATE `label` = :label, `isAdmin` = :isAdmin, `isSystem` = :isSystem',
      { id: r.id, label: r.label, isAdmin: r.isAdmin ?? false, isSystem: r.isSystem ?? false },
    );
  }

  for (const [roleId, moduleKey, canRead, canWrite] of SEED_PERMISSIONS) {
    await db.execute<ResultSetHeader>(
      'INSERT INTO `RolePermission` (`roleId`, `moduleKey`, `canRead`, `canWrite`) ' +
        'VALUES (:roleId, :moduleKey, :canRead, :canWrite) ' +
        'ON DUPLICATE KEY UPDATE `canRead` = :canRead, `canWrite` = :canWrite',
      { roleId, moduleKey, canRead, canWrite },
    );
  }

  for (const p of SEED_PLANS) {
    // Create the plan if missing, but don't clobber an admin-renamed plan.
    await db.execute<ResultSetHeader>(
      'INSERT INTO `Plan` (`id`, `name`, `description`, `isDefault`, `active`) ' +
        'VALUES (:id, :name, :description, :isDefault, true) ' +
        'ON DUPLICATE KEY UPDATE `id` = `id`',
      { id: p.id, name: p.name, description: p.description, isDefault: p.isDefault ?? false },
    );
    for (const moduleKey of p.modules) {
      await db.execute<ResultSetHeader>(
        'INSERT INTO `PlanModule` (`planId`, `moduleKey`) VALUES (:planId, :moduleKey) ' +
          'ON DUPLICATE KEY UPDATE `moduleKey` = :moduleKey',
        { planId: p.id, moduleKey },
      );
    }
  }

  logger.info(
    { roles: SEED_ROLES.length, plans: SEED_PLANS.length },
    'seeded access bootstrap (roles + default plan, non-destructive)',
  );
}
