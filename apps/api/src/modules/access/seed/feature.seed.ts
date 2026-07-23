import type { ResultSetHeader } from 'mysql2';
import { db } from '../../../db.js';
import { logger } from '../../../logger.js';

/**
 * Bootstraps the NON-ADMIN (feature) modules and the baseline role permissions
 * for the student, mentor, marketing and accountant roles. This is separate from
 * access.seed.ts, which only bootstraps the admin-console modules.
 *
 * Module definitions here are code-owned: a reseed re-asserts label/icon/route/
 * sortOrder (ON DUPLICATE KEY UPDATE) so the sidebar stays in sync with the pages
 * shipped in apps/web. It never deletes a module. The role permissions below are
 * the shipped defaults — a reseed re-asserts them too, so any later tweaks an admin
 * makes to THESE role/module rows are reset on the next seed. Admin-created roles
 * and any other modules are never touched.
 *
 * The student/mentor/marketing/accountant roles themselves are seeded by
 * access.seed.ts (SEED_ROLES); this file only grants them module access.
 */
type FeatureModule = { key: string; label: string; icon: string; route: string; sortOrder: number };

export const SEED_FEATURE_MODULES: FeatureModule[] = [
  // Student
  { key: 'learning', label: 'Learning', icon: 'BookOpen', route: '/learning', sortOrder: 12 },
  { key: 'projects', label: 'Projects', icon: 'Code2', route: '/projects', sortOrder: 13 },
  { key: 'mentors', label: 'Find a Mentor', icon: 'UserRound', route: '/mentors', sortOrder: 14 },
  { key: 'live-sessions', label: 'Live Sessions', icon: 'Radio', route: '/live-sessions', sortOrder: 15 },
  { key: 'jobs', label: 'Jobs', icon: 'Briefcase', route: '/jobs', sortOrder: 16 },
  { key: 'career-chat', label: 'Chat with Mentor', icon: 'MessagesSquare', route: '/chat-with-mentor', sortOrder: 17 },
  { key: 'coding', label: 'Coding', icon: 'Code2', route: '/coding', sortOrder: 18 },
  { key: 'support', label: 'Support', icon: 'Headphones', route: '/support', sortOrder: 19 },

  // Mentor
  { key: 'mentor-live-sessions', label: 'My Live Sessions', icon: 'Video', route: '/mentor-live-sessions', sortOrder: 20 },
  { key: 'mentor-mentors', label: 'Mentorship', icon: 'Users', route: '/mentor-mentors', sortOrder: 21 },

  // Content management — role-gated video library (edit/delete/visibility/thumbnail).
  { key: 'manage-videos', label: 'Manage Videos', icon: 'Clapperboard', route: '/manage-videos', sortOrder: 22 },

  // AI operations — role-gated tuning of every feature's AI system prompt + temperature.
  { key: 'manage-ai-prompts', label: 'AI Prompts', icon: 'Wand2', route: '/manage-ai-prompts', sortOrder: 23 },

  // Content management — role-gated coding-task authoring + submission review.
  { key: 'coding-tasks', label: 'Coding Tasks', icon: 'SquareCode', route: '/manage-coding-tasks', sortOrder: 24 },

  // HR
  { key: 'hr-jobs', label: 'Job Postings', icon: 'Building2', route: '/hr-jobs', sortOrder: 25 },

  // Marketing
  { key: 'connect-profile', label: 'Channels', icon: 'Share2', route: '/connect-profile', sortOrder: 30 },
  { key: 'linkedin', label: 'LinkedIn', icon: 'Linkedin', route: '/linkedin', sortOrder: 31 },
  { key: 'facebook', label: 'Facebook', icon: 'Facebook', route: '/facebook', sortOrder: 32 },
  { key: 'email', label: 'Email', icon: 'Mail', route: '/email', sortOrder: 33 },
  { key: 'leads', label: 'Leads', icon: 'UserPlus', route: '/leads', sortOrder: 34 },
  { key: 'ai-assistant', label: 'AI Assistant', icon: 'Sparkles', route: '/ai-assistant', sortOrder: 35 },

  // Accountant
  { key: 'transactions', label: 'Transactions', icon: 'Receipt', route: '/transactions', sortOrder: 40 },

  // Shared across feature roles
  { key: 'analytics', label: 'Analytics', icon: 'LineChart', route: '/analytics', sortOrder: 50 },
  { key: 'community', label: 'Community', icon: 'MessagesSquare', route: '/community', sortOrder: 51 },
];

// [roleId, moduleKey, canRead, canWrite]. canWrite is granted where the role
// produces data in the module; analytics is read-only for everyone.
type Perm = [string, string, boolean, boolean];

export const SEED_FEATURE_PERMISSIONS: Perm[] = [
  // Student — learns, joins sessions & community.
  ['student', 'learning', true, false],
  ['student', 'projects', true, true],
  ['student', 'mentors', true, true],
  ['student', 'live-sessions', true, true],
  // Students browse the board (read) and can trigger AI discovery for themselves (write).
  ['student', 'jobs', true, true],
  // Chat with Mentor: read to load the thread, write to send messages & enroll.
  ['student', 'career-chat', true, true],
  // Coding: read the task list & solve; write to submit solutions.
  ['student', 'coding', true, true],
  ['student', 'support', true, true],
  ['student', 'analytics', true, false],
  ['student', 'community', true, true],

  // Mentor — hosts live sessions and manages mentorship bookings.
  ['mentor', 'mentor-live-sessions', true, true],
  ['mentor', 'mentor-mentors', true, true],
  ['mentor', 'live-sessions', true, true],
  // Coding task authoring + submission review (the manager surface).
  ['mentor', 'coding-tasks', true, true],
  ['mentor', 'analytics', true, false],
  ['mentor', 'community', true, true],

  // Marketing — manages channels and campaign content.
  ['marketing', 'connect-profile', true, true],
  ['marketing', 'linkedin', true, true],
  ['marketing', 'facebook', true, true],
  ['marketing', 'email', true, true],
  ['marketing', 'leads', true, true],
  ['marketing', 'ai-assistant', true, true],
  ['marketing', 'analytics', true, false],
  ['marketing', 'community', true, true],

  // Accountant — owns the transaction ledger.
  ['accountant', 'transactions', true, true],
  ['accountant', 'analytics', true, false],
  ['accountant', 'community', true, true],

  // HR — posts and manages job openings; can also browse the live board.
  ['hr', 'hr-jobs', true, true],
  ['hr', 'jobs', true, false],
  ['hr', 'analytics', true, false],
  ['hr', 'community', true, true],
];

export async function seedFeatures(): Promise<void> {
  for (const m of SEED_FEATURE_MODULES) {
    await db.execute<ResultSetHeader>(
      'INSERT INTO `Module` (`key`, `label`, `icon`, `route`, `parentKey`, `sortOrder`, `active`) ' +
        'VALUES (:key, :label, :icon, :route, NULL, :sortOrder, true) ' +
        'ON DUPLICATE KEY UPDATE `label` = :label, `icon` = :icon, `route` = :route, `sortOrder` = :sortOrder',
      { key: m.key, label: m.label, icon: m.icon, route: m.route, sortOrder: m.sortOrder },
    );
  }

  for (const [roleId, moduleKey, canRead, canWrite] of SEED_FEATURE_PERMISSIONS) {
    await db.execute<ResultSetHeader>(
      'INSERT INTO `RolePermission` (`roleId`, `moduleKey`, `canRead`, `canWrite`) ' +
        'VALUES (:roleId, :moduleKey, :canRead, :canWrite) ' +
        'ON DUPLICATE KEY UPDATE `canRead` = :canRead, `canWrite` = :canWrite',
      { roleId, moduleKey, canRead, canWrite },
    );
  }

  logger.info(
    { modules: SEED_FEATURE_MODULES.length, permissions: SEED_FEATURE_PERMISSIONS.length },
    'seeded feature modules + role permissions',
  );
}
