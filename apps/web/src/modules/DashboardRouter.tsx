import type { ComponentType } from 'react';
import { useMyAccess } from '../lib/access.js';
import { getStoredUser } from '../lib/auth.js';
import { StudentDashboard } from './student/StudentDashboard.js';
import { MentorDashboard } from './mentor/MentorDashboard.js';
import { MarketingDashboard } from './marketing/MarketingDashboard.js';

// Each role resolves to its own dashboard module. New roles get an entry here.
// Admin is intentionally excluded — it lives in its own separate shell (AdminLayout).
const DASHBOARDS: Record<string, ComponentType> = {
  student: StudentDashboard,
  mentor: MentorDashboard,
  marketing: MarketingDashboard,
};

/**
 * Role-aware dashboard. The app shell (sidebar/header) is shared and renders
 * conditionally by entitlements; only the content differs per role.
 *
 * Picks the dashboard synchronously from the stored role so the chosen dashboard's own data
 * starts loading IMMEDIATELY — no waiting a round-trip on /me/modules first (that would serialize
 * the two requests). Once access resolves, its RBAC roleId wins (handles custom roles); for the
 * common student/mentor/marketing case the stored role already matches, so there's no swap.
 */
export function DashboardPage() {
  const { data } = useMyAccess();
  const roleId = data?.roleId ?? getStoredUser()?.role ?? 'student';
  const Dashboard = DASHBOARDS[roleId] ?? StudentDashboard;
  return <Dashboard />;
}
