import { useEffect, useMemo, useState } from 'react';
import { Bell, Boxes, CreditCard, Home, LogOut, ShieldCheck, Users } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppShell, Avatar, IconButton, Sidebar, SidebarItem, TopBar } from '@mentra/ui';
import { LogoutConfirmModal } from '../../components/LogoutConfirmModal.js';
import { useSmoothScroll } from '../../lib/smoothScroll.js';
import {
  clearAuthSession,
  fetchCurrentUser,
  getAccessToken,
  getApiBaseUrl,
  getStoredUser,
  type AuthUser,
} from '../../lib/auth.js';

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: <Home />, path: '/admin' },
  { key: 'users', label: 'Users', icon: <Users />, path: '/admin/users' },
  { key: 'roles', label: 'Roles & permissions', icon: <ShieldCheck />, path: '/admin/roles' },
  { key: 'subscriptions', label: 'Subscriptions', icon: <CreditCard />, path: '/admin/subscriptions' },
  { key: 'modules', label: 'Modules', icon: <Boxes />, path: '/admin/modules' },
];

function activeAdminKey(pathname: string): string {
  if (pathname.startsWith('/admin/users')) return 'users';
  if (pathname.startsWith('/admin/roles')) return 'roles';
  if (pathname.startsWith('/admin/subscriptions')) return 'subscriptions';
  if (pathname.startsWith('/admin/modules')) return 'modules';
  return 'dashboard';
}

/**
 * Standalone admin shell — its own fixed nav rail and header, fully decoupled
 * from the entitlement-driven student/mentor AppLayout.
 */
export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [loadingUser, setLoadingUser] = useState(true);
  const [logoutOpen, setLogoutOpen] = useState(false);

  // App-wide inertial wheel smoothing on the main scroll area.
  useSmoothScroll('#app-scroll-root');

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

  const displayName = user?.name ?? 'Admin';
  const todayLabel = useMemo(() => formatToday(), []);
  const activeKey = activeAdminKey(location.pathname);

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
    <AppShell
      sidebar={
        <Sidebar
          brand={
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-inverse text-ink-inverse"
            >
              <img src="/brand/mentra-icon-white.png" alt="Mentra" className="h-5 w-auto" />
            </button>
          }
          footer={
            <IconButton variant="dark" size="md" label="Sign out" onClick={() => setLogoutOpen(true)}>
              <LogOut />
            </IconButton>
          }
        >
          {NAV.map((item) => (
            <SidebarItem
              key={item.key}
              icon={item.icon}
              label={item.label}
              active={item.key === activeKey}
              onClick={() => navigate(item.path)}
            />
          ))}
        </Sidebar>
      }
      topBar={
        <TopBar
          left={
            <div className="flex items-center gap-3 pl-2">
              <div className="text-sm">
                <div className="text-ink-muted">{todayLabel}</div>
                <div className="flex items-center gap-1.5 font-medium text-ink">
                  <ShieldCheck className="size-4 text-accent-amber" />
                  Admin console
                </div>
              </div>
              <div className="ml-4 hidden md:block">
                <div className="text-display-sm leading-tight">Administration</div>
                <div className="text-xs text-ink-muted">{user?.email ?? 'Checking session…'}</div>
              </div>
            </div>
          }
          right={
            <>
              <IconButton variant="dark" size="md" label="Notifications">
                <Bell />
              </IconButton>
              <div className="hidden items-center gap-2 rounded-full bg-surface px-2 py-1.5 ring-1 ring-border-subtle md:flex">
                <Avatar size="sm" name={displayName} online={!loadingUser} />
                <div className="pr-2 text-xs">
                  <div className="font-medium text-ink">{displayName}</div>
                  <div className="text-ink-faint">Administrator</div>
                </div>
              </div>
            </>
          }
        />
      }
    >
      <Outlet />
      <LogoutConfirmModal open={logoutOpen} onCancel={() => setLogoutOpen(false)} onConfirm={handleLogout} />
    </AppShell>
  );
}

function formatToday() {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: '2-digit', month: 'short' }).format(new Date());
}
