import type { ComponentType } from 'react';
import { useMyAccess } from '../lib/access.js';
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
 */
export function DashboardPage() {
  const { data, isLoading } = useMyAccess();

  if (isLoading) {
    return <div className="grid min-h-[60vh] place-items-center text-ink-muted">Loading…</div>;
  }

  const Dashboard = (data && DASHBOARDS[data.roleId]) || StudentDashboard;
  return <Dashboard />;
}
