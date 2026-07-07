import { useEffect, useMemo, useState } from 'react';
import { Lock, LogOut, PanelLeftClose, PanelLeftOpen, Sparkles, Sun } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppShell, Avatar, Sidebar, TopBar } from '@mentra/ui';
import type { ModuleEntitlement } from '@mentra/shared';
import { AppSidebar, FOOTER_MODULE_KEYS, isRouteActive, SidebarLink, SidebarModuleButton } from './AppSidebar.js';
import { MobileBottomNav } from './MobileBottomNav.js';
import { NotificationBell } from './NotificationBell.js';
import { LogoutConfirmModal } from './LogoutConfirmModal.js';
import { useMyAccess } from '../lib/access.js';
import { useProfile } from '../lib/profile.js';
import { usePageViewTracking } from '../lib/activity.js';
import { ChromeContext, ChromeScrollWatcher } from '../lib/chrome.js';
import { useSmoothScroll } from '../lib/smoothScroll.js';
import {
  clearAuthSession,
  fetchCurrentUser,
  getAccessToken,
  getApiBaseUrl,
  getStoredUser,
  resolveAvatarUrl,
  type AuthUser,
} from '../lib/auth.js';

export type AppOutletContext = { user: AuthUser | null; loadingUser: boolean };

/**
 * Module pages the app ships (route prefix → module key). The guard authorizes
 * EVERY entry here, so a page is only reachable when the user's role can read the
 * module AND their plan unlocks it — regardless of how the URL was reached.
 * `/dashboard` and `/settings` are intentionally always-available (home + account).
 * Keep this in sync when adding a new module page.
 */
const APP_MODULE_ROUTES: { prefix: string; key: string }[] = [
  { prefix: '/assignment', key: 'assignment' },
  { prefix: '/roadmap', key: 'roadmap' },
  { prefix: '/learning', key: 'learning' },
  { prefix: '/projects', key: 'projects' },
  { prefix: '/live-sessions', key: 'live-sessions' },
  { prefix: '/jobs', key: 'jobs' },
  { prefix: '/mentor-live-sessions', key: 'mentor-live-sessions' },
  { prefix: '/mentor-mentors', key: 'mentor-mentors' },
  { prefix: '/hr-jobs', key: 'hr-jobs' },
  { prefix: '/mentors', key: 'mentors' },
  // /community is intentionally NOT listed — it's shared by every role and gated by
  // auth only (like /dashboard, /settings), so it's never plan/entitlement-locked.
  { prefix: '/connect-profile', key: 'connect-profile' },
  { prefix: '/linkedin', key: 'linkedin' },
  { prefix: '/facebook', key: 'facebook' },
  { prefix: '/email', key: 'email' },
  { prefix: '/leads', key: 'leads' },
  { prefix: '/ai-assistant', key: 'ai-assistant' },
  { prefix: '/analytics', key: 'analytics' },
  { prefix: '/support', key: 'support' },
  { prefix: '/subscriptions', key: 'subscriptions' },
  { prefix: '/about', key: 'about' },
];

/** The module key that guards a path (its prefix or a nested segment), or null. */
function guardedModuleKey(pathname: string): string | null {
  return (
    APP_MODULE_ROUTES.filter((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)).sort(
      (a, b) => b.prefix.length - a.prefix.length,
    )[0]?.key ?? null
  );
}

/**
 * Titles for the always-available pages that aren't plan-gated modules, so the
 * mobile header can still name them. Module pages fall back to their admin-authored
 * `label` from the access list.
 */
const STATIC_PAGE_TITLES: { prefix: string; title: string }[] = [
  { prefix: '/dashboard', title: 'Dashboard' },
  { prefix: '/settings', title: 'Settings' },
  { prefix: '/community', title: 'Community' },
  { prefix: '/manifesto', title: 'Manifesto' },
];

/**
 * Persistent app frame: the icon-rail sidebar and top header are always present;
 * routed pages render in the scrollable content area via <Outlet/>.
 */
export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [loadingUser, setLoadingUser] = useState(true);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [navExpanded, setNavExpanded] = useState(() => {
    try {
      return localStorage.getItem('navExpanded') === '1';
    } catch {
      return false;
    }
  });

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // App-chrome visibility (top bar + bottom nav), driven by pages via useHideChromeOnScroll.
  const [chromeHidden, setChromeHidden] = useState(false);
  const chromeValue = useMemo(
    () => ({ hidden: chromeHidden, setHidden: setChromeHidden }),
    [chromeHidden],
  );
  const isDesktop = useIsDesktop();
  // On mobile the rail is an off-canvas drawer — always show titles there.
  const railExpanded = isDesktop ? navExpanded : true;

  function toggleNav() {
    setNavExpanded((v) => {
      const next = !v;
      try {
        localStorage.setItem('navExpanded', next ? '1' : '0');
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const resolved = await fetchCurrentUser();
      if (cancelled) return;
      if (!resolved) {
        clearAuthSession();
        navigate('/auth', { replace: true });
        return;
      }
      setUser(resolved);
      setLoadingUser(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Close the mobile drawer whenever the route changes (nav click / back / forward).
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Ensure the drawer can't stay "open" once we're on a desktop viewport.
  useEffect(() => {
    if (isDesktop) setMobileNavOpen(false);
  }, [isDesktop]);

  // App-wide inertial wheel smoothing on the main scroll area.
  useSmoothScroll('#app-scroll-root');

  // Record a page.view on every route change (feeds the activity tracker).
  usePageViewTracking();

  const displayName = user?.name ?? 'Student';
  const todayLabel = useMemo(() => formatToday(), []);

  // Avatar for the header. Sourced from the profile query (not the cached AuthUser,
  // which has no avatar) so it refreshes automatically when an upload invalidates
  // ['profile','me']. The URL is already cache-busted (?v=timestamp) server-side.
  const { data: profileMe } = useProfile();
  const avatarSrc = resolveAvatarUrl(profileMe?.profile?.avatarUrl);

  // Module-access guard. Blocks a module page when the user's role can't read it
  // ('forbidden') or their plan doesn't unlock it ('locked'). Admins bypass.
  const { data: access, isLoading: accessLoading } = useMyAccess();
  const denied = (() => {
    if (accessLoading || access?.isAdmin) return null;
    const key = guardedModuleKey(location.pathname);
    if (!key) return null;
    const ent = access?.modules.find((m) => m.key === key) ?? null;
    if (!ent) return { kind: 'forbidden' as const };
    if (!ent.unlocked) return { kind: 'locked' as const, module: ent };
    return null;
  })();

  // Show the user's actual assigned RBAC role (not the coarse legacy user.role).
  const roleLabel = formatRole(access?.roleId ?? user?.role);

  // Title of the page the user is on — shown in the mobile header. Prefer the
  // module's admin-authored label; fall back to the always-available static pages.
  const currentModuleTitle = (() => {
    const key = guardedModuleKey(location.pathname);
    const moduleLabel = key ? access?.modules.find((m) => m.key === key)?.label : null;
    if (moduleLabel) return moduleLabel;
    return (
      STATIC_PAGE_TITLES.find(
        (p) => location.pathname === p.prefix || location.pathname.startsWith(`${p.prefix}/`),
      )?.title ?? 'Mentra'
    );
  })();

  // Modules pinned to the bottom of the rail (e.g. About), rendered above logout.
  const footerModules = (access?.modules ?? []).filter(
    (m) => !m.parentKey && m.placement === 'sidebar' && FOOTER_MODULE_KEYS.includes(m.key),
  );

  async function handleLogout() {
    const token = getAccessToken();
    clearAuthSession();
    if (token) {
      try {
        await fetch(`${getApiBaseUrl()}/api/v1/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
      } catch {
        /* local session already cleared */
      }
    }
    navigate('/auth', { replace: true });
  }

  return (
    <ChromeContext.Provider value={chromeValue}>
    <AppShell
      sidebarWidth={navExpanded ? '240px' : '72px'}
      chromeHidden={chromeHidden}
      mobileNavOpen={mobileNavOpen}
      onMenuClick={() => setMobileNavOpen(true)}
      onCloseMobileNav={() => setMobileNavOpen(false)}
      mobileBrand={
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          aria-label="Mentra home"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-inverse text-ink-inverse"
        >
          <img src="/brand/mentra-icon-black.png" alt="Mentra" className="h-5 w-auto" />
        </button>
      }
      bottomNav={<MobileBottomNav onMenuClick={() => setMobileNavOpen(true)} hidden={chromeHidden} />}
      sidebar={
        <Sidebar
          expanded={railExpanded}
          brand={
            <div className={railExpanded ? 'flex items-center gap-2' : 'flex flex-col items-center gap-2'}>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-inverse text-ink-inverse"
              >
                <img src="/brand/mentra-icon-black.png" alt="Mentra" className="h-5 w-auto" />
              </button>
              {railExpanded ? <span className="flex-1 truncate text-base font-bold text-ink">Mentra</span> : null}
              {/* Collapse/expand toggle is desktop-only (mobile uses the off-canvas drawer). */}
              <button
                type="button"
                onClick={toggleNav}
                aria-label={navExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
                title={navExpanded ? 'Collapse' : 'Expand'}
                className="hidden size-9 shrink-0 place-items-center rounded-md text-ink-muted transition hover:bg-surface hover:text-ink md:grid [&_svg]:size-5"
              >
                {navExpanded ? <PanelLeftClose /> : <PanelLeftOpen />}
              </button>
            </div>
          }
          footer={
            <>
              {footerModules.map((m) => (
                <SidebarModuleButton key={m.key} module={m} pathname={location.pathname} expanded={railExpanded} />
              ))}
              {/* Manifesto entry — mobile drawer only (md:hidden never shows on the
                  desktop rail, which is itself hidden below md), students only. The
                  dashboard keeps its own floating CTA on desktop. */}
              {access?.roleId === 'student' ? (
                <div className="md:hidden">
                  <SidebarLink
                    icon={<Sparkles />}
                    label="Read the Manifesto"
                    active={isRouteActive('/manifesto', location.pathname)}
                    expanded={railExpanded}
                    onClick={() => navigate('/manifesto')}
                  />
                </div>
              ) : null}
              <SidebarLink icon={<LogOut />} label="Sign out" danger expanded={railExpanded} onClick={() => setLogoutOpen(true)} />
            </>
          }
        >
          <AppSidebar pathname={location.pathname} expanded={railExpanded} />
        </Sidebar>
      }
      topBar={
        <TopBar
          left={
            <div className="flex items-center gap-3 pl-2">
              <div className="text-sm">
                <div className="text-ink-muted">{todayLabel}</div>
                <div className="flex items-center gap-1.5 font-medium text-ink">
                  <Sun className="size-4 text-accent-amber" />
                  {/* Mobile: name the current page. Desktop keeps the online status. */}
                  <span className="md:hidden">{currentModuleTitle}</span>
                  <span className="hidden md:inline">{loadingUser ? 'Loading' : 'Online'}</span>
                </div>
              </div>
              <div className="ml-4 hidden md:block">
                <div className="text-display-sm leading-tight">Welcome, {firstName(displayName)}</div>
                <div className="text-xs text-ink-muted">{user?.email ?? 'Checking session…'}</div>
              </div>
            </div>
          }
          searchPlaceholder="Search skills, tasks, roadmap…"
          right={
            <>
              <NotificationBell />
              <button
                type="button"
                onClick={() => navigate('/settings')}
                aria-label="Open profile settings"
                className="flex items-center gap-2 rounded-full bg-surface p-1 ring-1 ring-border-subtle transition hover:ring-border-strong md:px-2 md:py-1.5"
              >
                <Avatar size="sm" src={avatarSrc} name={displayName} online={!loadingUser} />
                <div className="hidden pr-2 text-left text-xs md:block">
                  <div className="font-medium text-ink">{displayName}</div>
                  <div className="text-ink-faint">{roleLabel}</div>
                </div>
              </button>
            </>
          }
        />
      }
    >
      {/* Global hide-on-scroll for pages that scroll in the main root; re-keyed per
          route so it re-anchors and reveals the chrome on every navigation. The watch
          page owns its chrome (force-hidden for an immersive player), so skip it there. */}
      {!location.pathname.startsWith('/live-sessions/') ? (
        <ChromeScrollWatcher key={location.pathname} />
      ) : null}
      {accessLoading ? (
        <div className="grid min-h-[60vh] place-items-center text-ink-muted">Loading…</div>
      ) : denied?.kind === 'locked' ? (
        <NoModuleAccess
          module={denied.module}
          onHome={() => navigate('/dashboard')}
          onPlans={() => navigate('/subscriptions')}
        />
      ) : denied?.kind === 'forbidden' ? (
        <NoAccess onHome={() => navigate('/dashboard')} />
      ) : (
        <Outlet context={{ user, loadingUser } satisfies AppOutletContext} />
      )}
      <LogoutConfirmModal open={logoutOpen} onCancel={() => setLogoutOpen(false)} onConfirm={handleLogout} />
    </AppShell>
    </ChromeContext.Provider>
  );
}

/**
 * Shown when a user hits a route for a module their plan doesn't unlock. Instead
 * of a bare "denied", it tells them what the module is — using the admin-authored
 * `description` (set when creating the module) — and points them at the plans.
 */
function NoModuleAccess({
  module,
  onHome,
  onPlans,
}: {
  module: ModuleEntitlement;
  onHome: () => void;
  onPlans: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-xl py-6">
      <div className="overflow-hidden rounded-lg bg-surface ring-1 ring-border">
        <div className="flex items-center gap-3 border-b border-border-subtle bg-surface-sunken px-6 py-4">
          <span className="grid size-10 place-items-center rounded-md bg-surface-inverse text-ink-inverse">
            <Lock className="size-5" />
          </span>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">Locked module</div>
            <h2 className="text-display-sm leading-tight tracking-normal">{module.label}</h2>
          </div>
        </div>

        <div className="px-6 py-6">
          <p className="text-sm leading-7 text-ink-muted">
            {module.description?.trim()
              ? module.description
              : `${module.label} isn’t included in your current plan yet.`}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onPlans}
              className="h-10 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse transition hover:bg-ink"
            >
              View plans &amp; unlock
            </button>
            <button
              type="button"
              onClick={onHome}
              className="h-10 rounded-md bg-surface-sunken px-5 text-sm font-medium text-ink ring-1 ring-border-subtle transition hover:ring-border-strong"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Shown when the user's role isn't permitted to read a module at all (not a plan issue). */
function NoAccess({ onHome }: { onHome: () => void }) {
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center text-center">
      <div>
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-surface-sunken text-ink-muted ring-1 ring-border-subtle">
          <Lock className="size-5" />
        </div>
        <h2 className="text-display-sm tracking-normal">You don’t have access to this page</h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          This area isn’t available for your role. If you think this is a mistake, contact an admin.
        </p>
        <button
          type="button"
          onClick={onHome}
          className="mt-6 h-10 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse transition hover:bg-ink"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

function formatRole(role?: string | null) {
  if (!role) return 'Student';
  return role
    .split(/[-_]/)
    .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

function formatToday() {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: '2-digit', month: 'short' }).format(new Date());
}

/** True at the `md` breakpoint and up (matches Tailwind's 768px). */
function useIsDesktop(): boolean {
  const query = '(min-width: 768px)';
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : true,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}
