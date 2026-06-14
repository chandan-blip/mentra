import type { ReactNode } from 'react';
import { cn } from '../cn.js';

export interface AppShellProps {
  sidebar: ReactNode;
  topBar?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Width of the left rail on desktop (e.g. '72px' collapsed, '240px' expanded). */
  sidebarWidth?: string;
  /** Mobile off-canvas drawer open state. */
  mobileNavOpen?: boolean;
  /** Open the mobile drawer (hamburger). */
  onMenuClick?: () => void;
  /** Close the mobile drawer (backdrop / nav). */
  onCloseMobileNav?: () => void;
}

/**
 * Three-region layout — collapsible left rail (desktop) / off-canvas drawer (mobile),
 * optional top bar, main scrollable content area.
 */
export function AppShell({
  sidebar,
  topBar,
  children,
  className,
  sidebarWidth = '72px',
  mobileNavOpen,
  onMenuClick,
  onCloseMobileNav,
}: AppShellProps) {
  return (
    <div className={cn('flex h-full min-h-screen w-full bg-canvas text-ink', className)}>
      {/* Desktop rail */}
      <div
        className="sticky top-0 hidden h-screen shrink-0 border-r border-border-subtle transition-[width] duration-200 ease-out md:block"
        style={{ width: sidebarWidth }}
      >
        {sidebar}
      </div>

      {/* Mobile off-canvas drawer */}
      <div className={cn('fixed inset-0 z-50 md:hidden', mobileNavOpen ? '' : 'pointer-events-none')} aria-hidden={!mobileNavOpen}>
        <div
          className={cn('absolute inset-0 bg-black/40 transition-opacity duration-200', mobileNavOpen ? 'opacity-100' : 'opacity-0')}
          onClick={onCloseMobileNav}
        />
        <div
          className={cn(
            'absolute left-0 top-0 h-full w-64 border-r border-border-subtle bg-canvas shadow-xl transition-transform duration-200 ease-out',
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {/* Mounted only while open so the rail's single instance owns the shared
              active-indicator layoutId (no duplicate with the desktop rail). */}
          {mobileNavOpen ? sidebar : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {topBar && (
          <div className="sticky top-0 z-20 flex items-center border-b border-border-subtle bg-canvas/80 backdrop-blur">
            {onMenuClick ? (
              <button
                type="button"
                onClick={onMenuClick}
                aria-label="Open menu"
                className="ml-2 grid size-10 shrink-0 place-items-center rounded-md text-ink-muted transition hover:bg-surface hover:text-ink md:hidden"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5">
                  <path d="M3 6h18M3 12h18M3 18h18" />
                </svg>
              </button>
            ) : null}
            <div className="min-w-0 flex-1">{topBar}</div>
          </div>
        )}
        <main id="app-scroll-root" className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
