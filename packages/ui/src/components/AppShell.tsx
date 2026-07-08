import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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
  /**
   * Mobile-only top-left content. When provided, it replaces the hamburger button
   * (e.g. the menu trigger has moved to a bottom nav, freeing the corner for a logo).
   */
  mobileBrand?: ReactNode;
  /**
   * Mobile-only bottom navigation. Rendered fixed to the viewport bottom; when set,
   * the content area reserves bottom padding so nothing hides behind it.
   */
  bottomNav?: ReactNode;
  /**
   * When true, the top bar smoothly collapses out of view (a page requested it via
   * the chrome-visibility context, e.g. hide-on-scroll). Bottom-nav hiding is driven
   * separately by the bottomNav element itself.
   */
  chromeHidden?: boolean;
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
  mobileBrand,
  bottomNav,
  chromeHidden,
}: AppShellProps) {
  // Measure the top bar so we can animate its height 0↔natural without a layout
  // jump (translate alone would leave a canvas-colored gap above the content).
  const topBarRef = useRef<HTMLDivElement>(null);
  const [topBarHeight, setTopBarHeight] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const el = topBarRef.current;
    if (!el) return;
    const measure = () => setTopBarHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [topBar]);

  return (
    <div className={cn('flex h-full min-h-dvh w-full bg-canvas text-ink', className)}>
      {/* Desktop rail */}
      <div
        className="sticky top-0 hidden h-dvh shrink-0 border-r border-border-subtle transition-[width] duration-200 ease-out md:block"
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
          <div
            className="sticky top-0 z-20 overflow-hidden transition-[height] duration-300 ease-out"
            style={{ height: chromeHidden ? 0 : topBarHeight }}
          >
            <div
              ref={topBarRef}
              className="flex items-center border-b border-border-subtle bg-canvas/80 backdrop-blur"
            >
              {mobileBrand ? (
                <div className="ml-2 shrink-0 md:hidden">{mobileBrand}</div>
              ) : onMenuClick ? (
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
          </div>
        )}
        <main
          id="app-scroll-root"
          className={cn(
            // `overscroll-y-contain` keeps iOS rubber-band from chaining to the body (which makes
            // the whole app bounce and feel disconnected during momentum scroll).
            'flex-1 overflow-y-auto overscroll-y-contain p-3 md:p-8',
            bottomNav && 'pb-24 md:pb-8',
          )}
        >
          {children}
        </main>
      </div>

      {bottomNav}
    </div>
  );
}
