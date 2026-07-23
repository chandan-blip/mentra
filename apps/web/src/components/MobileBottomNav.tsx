import type { ReactNode } from 'react';
import { Code2, Home, MessageSquare, Menu, Users, Video } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMyAccess } from '../lib/access.js';
import { moduleIcon } from '../lib/moduleIcons.js';
import { isRouteActive } from './AppSidebar.js';

/**
 * Mobile-only bottom navigation. Fixed slots: Dashboard, Find Mentor, Live Sessions,
 * Community, and Menu (opens the full off-canvas drawer). Hidden at `md` and up, where
 * the persistent left rail takes over. The middle items render the same icon the admin
 * configured for that module in the DB (matched by key), so they stay in sync with the
 * rail; `fallbackIcon` covers a role whose module list omits the key.
 *
 * Access control mirrors the rail (see AppSidebar): a middle item backed by a module is
 * only shown when that module is in the user's server-filtered access list (role can
 * read it), and it's dimmed/inert when the module is plan-locked or not-yet-built —
 * exactly like `SidebarModuleButton`. Items flagged `alwaysAvailable` (auth-gated only,
 * no plan module — e.g. Community) render regardless of the module list.
 */
const MIDDLE_ITEMS: {
  key: string;
  label: string;
  route: string;
  fallbackIcon: ReactNode;
  alwaysAvailable?: boolean;
}[] = [
  { key: 'mentors', label: 'Find Mentor', route: '/mentors', fallbackIcon: <Users /> },
  { key: 'live-sessions', label: 'Live Sessions', route: '/live-sessions', fallbackIcon: <Video /> },
  { key: 'coding', label: 'Coding', route: '/coding', fallbackIcon: <Code2 /> },
  // Community is auth-gated only (not a plan module), so it has no DB icon/entitlement.
  { key: 'community', label: 'Community', route: '/community', fallbackIcon: <MessageSquare />, alwaysAvailable: true },
];

export function MobileBottomNav({ onMenuClick, hidden }: { onMenuClick: () => void; hidden?: boolean }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data } = useMyAccess();

  // Server-filtered entitlements keyed by module key (role can read → present here).
  const moduleByKey = new Map((data?.modules ?? []).map((m) => [m.key, m]));

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
      {MIDDLE_ITEMS.map((item) => {
        const mod = moduleByKey.get(item.key);
        // Hide items the role can't read (absent from entitlements), unless always-available.
        if (!mod && !item.alwaysAvailable) return null;

        const comingSoon = !!mod && !mod.route;
        const locked = !!mod && !comingSoon && !mod.unlocked;
        const usable = item.alwaysAvailable || (!comingSoon && !locked);
        const label = comingSoon
          ? `${item.label} (coming soon)`
          : locked
            ? `${item.label} (locked)`
            : item.label;

        return (
          <BottomNavItem
            key={item.route}
            icon={mod ? moduleIcon(mod.icon) : item.fallbackIcon}
            label={label}
            active={isRouteActive(item.route, pathname)}
            dim={!usable}
            onClick={() => {
              if (usable) navigate(item.route);
            }}
          />
        );
      })}
      <BottomNavItem icon={<Menu />} label="Menu" onClick={onMenuClick} />
    </nav>
  );
}

function BottomNavItem({
  icon,
  label,
  active,
  dim,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  dim?: boolean;
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
      } ${dim ? 'opacity-40' : ''}`}
    >
      <span className="grid place-items-center">{icon}</span>
      <span className="max-w-full truncate px-1">{label}</span>
    </button>
  );
}
