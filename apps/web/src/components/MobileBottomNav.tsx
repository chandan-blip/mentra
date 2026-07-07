import type { ReactNode } from 'react';
import { Home, MessageSquare, Menu, Users, Video } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMyAccess } from '../lib/access.js';
import { moduleIcon } from '../lib/moduleIcons.js';
import { isRouteActive } from './AppSidebar.js';

/**
 * Mobile-only bottom navigation. Fixed slots: Dashboard, Find Mentor, Live Sessions,
 * Community, and Menu (opens the full off-canvas drawer). Hidden at `md` and up, where
 * the persistent left rail takes over. The middle items render the same icon the admin
 * configured for that module in the DB (matched by key), so they stay in sync with the
 * rail; `fallbackIcon` covers a role whose module list omits the key. Locked/forbidden
 * routes are handled by the layout's access guard when tapped.
 */
const MIDDLE_ITEMS: { key: string; label: string; route: string; fallbackIcon: ReactNode }[] = [
  { key: 'mentors', label: 'Find Mentor', route: '/mentors', fallbackIcon: <Users /> },
  { key: 'live-sessions', label: 'Live Sessions', route: '/live-sessions', fallbackIcon: <Video /> },
  // Community is auth-gated only (not a plan module), so it has no DB icon — use the fallback.
  { key: 'community', label: 'Community', route: '/community', fallbackIcon: <MessageSquare /> },
];

export function MobileBottomNav({ onMenuClick, hidden }: { onMenuClick: () => void; hidden?: boolean }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data } = useMyAccess();

  // DB-configured icon name per module key, so the bar matches the rail.
  const iconByKey = new Map((data?.modules ?? []).map((m) => [m.key, m.icon]));

  return (
    <nav
      aria-label="Primary"
      className={`fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border-subtle bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur transition-transform duration-300 ease-out md:hidden ${
        hidden ? 'translate-y-full' : 'translate-y-0'
      }`}
    >
      <BottomNavItem
        icon={<Home />}
        label="Dashboard"
        active={isRouteActive('/dashboard', pathname)}
        onClick={() => navigate('/dashboard')}
      />
      {MIDDLE_ITEMS.map((m) => (
        <BottomNavItem
          key={m.route}
          icon={iconByKey.has(m.key) ? moduleIcon(iconByKey.get(m.key) ?? null) : m.fallbackIcon}
          label={m.label}
          active={isRouteActive(m.route, pathname)}
          onClick={() => navigate(m.route)}
        />
      ))}
      <BottomNavItem icon={<Menu />} label="Menu" onClick={onMenuClick} />
    </nav>
  );
}

function BottomNavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition [&_svg]:size-[22px] ${
        active ? 'text-ink' : 'text-ink-faint hover:text-ink-muted'
      }`}
    >
      <span className="grid place-items-center">{icon}</span>
      <span className="max-w-full truncate px-1">{label}</span>
    </button>
  );
}
