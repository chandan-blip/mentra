import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthPage } from './modules/auth/Auth.js';
import { DashboardPage } from './modules/DashboardRouter.js';
import { OnboardingPage } from './modules/account/Onboarding.js';
import { SettingsPage } from './modules/account/Settings.js';
import { AssignmentPage } from './modules/student/Assignment.js';
import { RoadmapPage } from './modules/student/Roadmap.js';
import { RoadmapAllPage } from './modules/student/RoadmapAll.js';
import { RoadmapItemPage } from './modules/student/RoadmapItem.js';
import { RoadmapHistoryPage } from './modules/student/RoadmapHistory.js';
import { SubscriptionsPage } from './modules/student/Subscriptions.js';
import { AnalyticsPage } from './modules/student/Analytics.js';
import { SupportPage } from './modules/student/Support.js';
import { LearningPage } from './modules/student/Learning.js';
import { ProjectsPage } from './modules/student/Projects.js';
import { LiveSessionsPage } from './modules/student/LiveSessions.js';
import { MentorsPage } from './modules/student/Mentors.js';
import { CommunityPage } from './modules/student/Community.js';
import { ManifestoPage } from './modules/student/Manifesto.js';
import { JobsPage } from './modules/student/Jobs.js';
import { MentorLiveSessionsPage } from './modules/mentor/MentorLiveSessions.js';
import { MentorMentorshipPage } from './modules/mentor/MentorMentorship.js';
import { HrJobsPage } from './modules/hr/HrJobs.js';
import { TransactionsPage } from './modules/accountant/Transactions.js';
import { ConnectProfilePage, EmailPage, FacebookPage, LinkedInPage } from './modules/marketing/Channels.js';
import { LeadsPage } from './modules/marketing/Leads.js';
import { LeadDetailPage } from './modules/marketing/LeadDetail.js';
import { AiAssistantPage } from './modules/marketing/AiAssistant.js';
import { AboutPage } from './modules/about/About.js';
import { AdminLayout } from './modules/admin/AdminLayout.js';
import { AdminDashboard } from './modules/admin/AdminDashboard.js';
import { AdminUsersPage } from './modules/admin/AdminUsers.js';
import { AdminRolesPage } from './modules/admin/AdminRoles.js';
import { AdminSubscriptionsPage } from './modules/admin/AdminSubscriptions.js';
import { AdminModulesPage } from './modules/admin/AdminModules.js';
import { AppLayout } from './components/AppLayout.js';
import { getAccessToken } from './lib/auth.js';
import { useProfile } from './lib/profile.js';
import { useMyAccess } from './lib/access.js';

export function App() {
  return (
    <Routes>
      {/* Full-screen (no app shell) */}
      <Route path="/" element={<PublicOnlyRoute element={<AuthPage />} />} />
      <Route path="/auth" element={<PublicOnlyRoute element={<AuthPage />} />} />
      <Route path="/onboarding" element={<ProtectedRoute element={<OnboardingPage />} />} />
      <Route path="/manifesto" element={<ProtectedRoute element={<ManifestoPage />} />} />

      {/* Student / mentor shell: entitlement-driven sidebar + header */}
      <Route element={<ProtectedRoute element={<RequireOnboarded element={<AppLayout />} />} />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/assignment" element={<AssignmentPage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="/roadmap/all" element={<RoadmapAllPage />} />
        <Route path="/roadmap/history" element={<RoadmapHistoryPage />} />
        <Route path="/roadmap/item/:id" element={<RoadmapItemPage />} />
        <Route path="/learning" element={<LearningPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/live-sessions" element={<LiveSessionsPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/mentors" element={<MentorsPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/mentor-live-sessions" element={<MentorLiveSessionsPage />} />
        <Route path="/mentor-mentors" element={<MentorMentorshipPage />} />
        <Route path="/hr-jobs" element={<HrJobsPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/connect-profile" element={<ConnectProfilePage />} />
        <Route path="/linkedin" element={<LinkedInPage />} />
        <Route path="/facebook" element={<FacebookPage />} />
        <Route path="/email" element={<EmailPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/leads/:id" element={<LeadDetailPage />} />
        <Route path="/ai-assistant" element={<AiAssistantPage />} />
        <Route path="/about" element={<AboutPage />} />
        {/* Any other path renders inside the shell so the access guard can show the
            locked-module screen even for modules that don't have a built page yet. */}
        <Route path="*" element={<ShellCatchAll />} />
      </Route>

      {/* Admin shell: fully separate layout, admin-only, no onboarding gate */}
      <Route element={<ProtectedRoute element={<RequireAdmin element={<AdminLayout />} />} />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/roles" element={<AdminRolesPage />} />
        <Route path="/admin/subscriptions" element={<AdminSubscriptionsPage />} />
        <Route path="/admin/modules" element={<AdminModulesPage />} />
      </Route>
    </Routes>
  );
}

/**
 * Catch-all rendered INSIDE the app shell. By the time it renders, AppLayout's
 * access guard has already shown the locked-module screen for any plan-locked
 * module — so this only handles admins (sent to their console) and genuine 404s.
 */
function ShellCatchAll() {
  const navigate = useNavigate();
  const { data, isLoading } = useMyAccess();
  if (isLoading) return <div className="grid min-h-[50vh] place-items-center text-ink-muted">Loading…</div>;
  if (data?.isAdmin) return <Navigate to="/admin" replace />;
  return (
    <div className="mx-auto grid min-h-[50vh] max-w-md place-items-center text-center">
      <div>
        <h2 className="text-display-sm tracking-normal">Page not available</h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">This page doesn’t exist or isn’t ready yet.</p>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="mt-6 h-10 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse transition hover:bg-ink"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

function ProtectedRoute({ element }: { element: JSX.Element }) {
  return getAccessToken() ? element : <Navigate to="/auth" replace />;
}

function PublicOnlyRoute({ element }: { element: JSX.Element }) {
  return getAccessToken() ? <RoleHome /> : element;
}

/** Sends an authenticated user to their home surface: admins to /admin, everyone else to /dashboard. */
function RoleHome() {
  const { data, isLoading } = useMyAccess();
  if (isLoading) {
    return <div className="grid min-h-screen place-items-center bg-canvas text-ink-muted">Loading…</div>;
  }
  return <Navigate to={data?.isAdmin ? '/admin' : '/dashboard'} replace />;
}

/** Bounces to the onboarding wizard until the profile is complete. */
function RequireOnboarded({ element }: { element: JSX.Element }) {
  const { data, isLoading, isError } = useProfile();
  if (isLoading) {
    return <div className="grid min-h-screen place-items-center bg-canvas text-ink-muted">Loading…</div>;
  }
  if (!isError && data && !data.profile.onboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }
  return element;
}

/** Admin-only gate based on the user's resolved RBAC role. */
function RequireAdmin({ element }: { element: JSX.Element }) {
  const { data, isLoading } = useMyAccess();
  if (isLoading) {
    return <div className="grid min-h-screen place-items-center bg-canvas text-ink-muted">Loading…</div>;
  }
  return data?.isAdmin ? element : <Navigate to="/dashboard" replace />;
}
