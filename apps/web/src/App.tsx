import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthPage } from './modules/auth/Auth.js';
import { DashboardPage } from './modules/DashboardRouter.js';
import { SettingsPage } from './modules/account/Settings.js';
import { SubscriptionsPage } from './modules/student/Subscriptions.js';
import { AnalyticsPage } from './modules/student/Analytics.js';
import { SupportPage } from './modules/student/Support.js';
import { LearningPage } from './modules/student/Learning.js';
import { LearningCategoryPage } from './modules/student/LearningCategory.js';
import { LearningTestPage } from './modules/student/LearningTest.js';
import { ProjectsPage } from './modules/student/Projects.js';
import { LiveSessionsPage } from './modules/student/LiveSessions.js';
import { WatchSessionPage } from './modules/student/WatchSession.js';
import { MentorsPage } from './modules/student/Mentors.js';
import { CommunityPage } from './modules/student/Community.js';
import { StudentsPage } from './modules/student/Students.js';
import { StudentProfilePage } from './modules/student/StudentProfile.js';
import { JobsPage } from './modules/student/Jobs.js';
import { ChatWithMentorPage } from './modules/student/ChatWithMentor.js';
import { CodingPage } from './modules/student/Coding.js';
import { CodingTaskPage } from './modules/student/CodingTask.js';
import { MentorLiveSessionsPage } from './modules/mentor/MentorLiveSessions.js';
import { ManageVideosPage } from './modules/manager/ManageVideos.js';
import { ManageAiPromptsPage } from './modules/manager/ManageAiPrompts.js';
import { ManageCodingTasksPage } from './modules/manager/ManageCodingTasks.js';
import { PublicWatchPage } from './modules/public/PublicWatch.js';
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
import { useMyAccess } from './lib/access.js';

export function App() {
  return (
    <Routes>
      {/* Root sends logged-in users to their home surface; logged-out visitors to /auth. */}
      <Route path="/" element={<RootLanding />} />
      {/* Full-screen (no app shell) */}
      <Route path="/auth" element={<PublicOnlyRoute element={<AuthPage />} />} />
      {/* Public shareable video — no auth, no shell; anyone with the link can watch. */}
      <Route path="/watch/:id" element={<PublicWatchPage />} />

      {/* App shell — login required. Logged-out visitors bounce to /auth. */}
      <Route element={<ProtectedRoute element={<AppLayout />} />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/learning" element={<LearningPage />} />
        <Route path="/learning/:categoryId" element={<LearningCategoryPage />} />
        <Route path="/learning/test/:testId" element={<LearningTestPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/live-sessions" element={<LiveSessionsPage />} />
        <Route path="/live-sessions/:id" element={<WatchSessionPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/chat-with-mentor" element={<ChatWithMentorPage />} />
        <Route path="/coding" element={<CodingPage />} />
        <Route path="/coding/:taskId" element={<CodingTaskPage />} />
        <Route path="/mentors" element={<MentorsPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/students/:id" element={<StudentProfilePage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/mentor-live-sessions" element={<MentorLiveSessionsPage />} />
        <Route path="/mentor-mentors" element={<MentorMentorshipPage />} />
        <Route path="/manage-videos" element={<ManageVideosPage />} />
        <Route path="/manage-ai-prompts" element={<ManageAiPromptsPage />} />
        <Route path="/manage-coding-tasks" element={<ManageCodingTasksPage />} />
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

/**
 * Root path (`/`): logged-in users route to their home surface (admins → /admin, everyone
 * else → /dashboard); logged-out visitors go straight to /auth.
 */
function RootLanding() {
  return getAccessToken() ? <RoleHome /> : <Navigate to="/auth" replace />;
}

/** Sends an authenticated user to their home surface: admins to /admin, everyone else to /dashboard. */
function RoleHome() {
  const { data, isLoading } = useMyAccess();
  if (isLoading) {
    return <div className="grid min-h-screen place-items-center bg-canvas text-ink-muted">Loading…</div>;
  }
  return <Navigate to={data?.isAdmin ? '/admin' : '/dashboard'} replace />;
}

/** Admin-only gate based on the user's resolved RBAC role. */
function RequireAdmin({ element }: { element: JSX.Element }) {
  const { data, isLoading } = useMyAccess();
  if (isLoading) {
    return <div className="grid min-h-screen place-items-center bg-canvas text-ink-muted">Loading…</div>;
  }
  return data?.isAdmin ? element : <Navigate to="/dashboard" replace />;
}
