import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { ModuleEntitlement } from '@mentra/shared';
import { IconButton } from '@mentra/ui';
import { useMyAccess } from '../lib/access.js';
import { moduleIcon as iconFor } from '../lib/moduleIcons.js';

/** Modules pinned to the bottom of the rail (above logout) instead of the top list. */
export const FOOTER_MODULE_KEYS = ['about'];

/**
 * Highlight a rail item by matching its actual route against the current path —
 * not by assuming the module key equals the path's first segment. That assumption
 * breaks for modules whose key differs from their route (e.g. Home → /dashboard).
 */
export function isRouteActive(route: string | null | undefined, pathname: string): boolean {
  if (!route) return false;
  return pathname === route || pathname.startsWith(`${route}/`);
}

/**
 * A single rail entry, in either layout:
 * - collapsed → a round icon button with a hover/focus label tooltip + active bar
 * - expanded  → a full-width row (icon + title) with an active highlight
 * `dim` greys out inert items (coming-soon / plan-locked); `danger` is for destructive
 * actions (e.g. sign out).
 */
export function SidebarLink({
  icon,
  label,
  active,
  onClick,
  dim,
  danger,
  expanded,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  dim?: boolean;
  danger?: boolean;
  expanded?: boolean;
}) {
  if (expanded) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`flex h-11 w-full shrink-0 items-center gap-3 rounded-md px-3 text-sm font-medium transition [&_svg]:size-5 ${
          active
            ? 'bg-surface-raised text-ink ring-1 ring-border-subtle'
            : danger
              ? 'text-ink-muted hover:bg-surface hover:text-accent-red'
              : 'text-ink-muted hover:bg-surface hover:text-ink'
        } ${dim ? 'opacity-40' : ''}`}
      >
        <span className="grid size-6 shrink-0 place-items-center">{icon}</span>
        <span className="truncate">{label}</span>
      </button>
    );
  }

  return (
    <RailTooltip label={label}>
      {active ? (
        <motion.span
          layoutId="sidebar-active-indicator"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="absolute bottom-0 -left-3 top-0 my-auto h-6 w-1 rounded-r-full bg-ink"
        />
      ) : null}
      <IconButton variant="dark" size="md" active={active} label={label} onClick={onClick} className={dim ? 'opacity-40' : ''}>
        {icon}
      </IconButton>
    </RailTooltip>
  );
}

/**
 * Hover/focus label for a collapsed-rail icon. The tooltip floats to the right of the 72px
 * rail, over the page content — so it must escape the nav's vertical scroll container. We render
 * it into a body-level portal with fixed positioning (measured from the anchor on reveal) rather
 * than as an absolutely-positioned child. A child tooltip would extend past the rail and, because
 * the scroll container's `overflow-y: auto` forces `overflow-x` to `auto` too, trigger a stray
 * horizontal scrollbar. The portal sidesteps that entirely while keeping the label visible.
 */
function RailTooltip({ label, children }: { label: string; children: ReactNode }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const reveal = () => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.top + r.height / 2, left: r.right + 12 });
  };
  const hide = () => setPos(null);

  return (
    <div
      ref={anchorRef}
      onMouseEnter={reveal}
      onMouseLeave={hide}
      onFocus={reveal}
      onBlur={hide}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center"
    >
      {children}
      {pos
        ? createPortal(
            <span
              role="tooltip"
              style={{ position: 'fixed', top: pos.top, left: pos.left }}
              className="pointer-events-none z-[100] -translate-y-1/2 whitespace-nowrap rounded-md bg-surface-inverse px-2.5 py-1.5 text-xs font-medium text-ink-inverse shadow-lg ring-1 ring-border-strong/60"
            >
              {label}
              <span
                aria-hidden
                className="absolute right-full top-1/2 h-0 w-0 -translate-y-1/2 border-y-4 border-r-4 border-y-transparent border-r-surface-inverse"
              />
            </span>,
            document.body,
          )
        : null}
    </div>
  );
}

/**
 * One module entry in the rail. Usable (route + plan unlocks) navigates; not-yet-built
 * modules (no route) and plan-locked modules render dimmed/inert. The label reflects state.
 */
export function SidebarModuleButton({
  module: m,
  pathname,
  expanded,
}: {
  module: ModuleEntitlement;
  pathname: string;
  expanded?: boolean;
}) {
  const navigate = useNavigate();
  const comingSoon = !m.route;
  const locked = !comingSoon && !m.unlocked;
  const usable = !comingSoon && !locked;
  const label = comingSoon
    ? `${m.label} (coming soon)`
    : locked
      ? `${m.label} (upgrade to unlock)`
      : m.label;

  return (
    <SidebarLink
      icon={iconFor(m.icon)}
      label={label}
      active={isRouteActive(m.route, pathname)}
      dim={!usable}
      expanded={expanded}
      onClick={() => {
        if (usable && m.route) navigate(m.route);
      }}
    />
  );
}

/**
 * Sidebar rail driven by the user's role permissions. Shows every top-level module
 * the role can read (server-filtered) with placement === 'sidebar', except the ones
 * pinned to the footer (rendered above logout by AppLayout).
 */
export function AppSidebar({ pathname, expanded }: { pathname: string; expanded?: boolean }) {
  const { data } = useMyAccess();
  const modules = (data?.modules ?? []).filter(
    (m) => !m.parentKey && m.placement === 'sidebar' && !FOOTER_MODULE_KEYS.includes(m.key),
  );

  return (
    <>
      {modules.map((m) => (
        <SidebarModuleButton key={m.key} module={m} pathname={pathname} expanded={expanded} />
      ))}
    </>
  );
}
