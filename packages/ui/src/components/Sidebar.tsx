import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../cn.js';
import { IconButton } from './IconButton.js';

export interface SidebarProps {
  /** Logo / brand mark slot at the top */
  brand?: ReactNode;
  /** Bottom slot, e.g. user avatar or logout */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** When true, items left-align into full-width rows (icon + title). */
  expanded?: boolean;
}

/**
 * Vertical navigation rail. Collapsed = round icon buttons centered; expanded =
 * full-width rows (icon + title), with brand and footer left-aligned.
 */
export function Sidebar({ brand, footer, children, className, expanded }: SidebarProps) {
  const align = expanded ? 'items-stretch' : 'items-center';
  return (
    <aside className={cn('flex h-full flex-col justify-between gap-6 px-3 py-6', align, className)}>
      <div className={cn('flex flex-col gap-2', align)}>
        {brand && <div className="mb-2">{brand}</div>}
        {children}
      </div>
      {footer && <div className={cn('flex flex-col gap-2', align)}>{footer}</div>}
    </aside>
  );
}

export interface SidebarItemProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function SidebarItem({ icon, label, active, onClick }: SidebarItemProps) {
  return (
    <motion.div initial={false} className="relative">
      <IconButton variant="dark" size="md" active={active} label={label} onClick={onClick}>
        {icon}
      </IconButton>
      {active && (
        <motion.div
          layoutId="sidebar-active-indicator"
          className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-ink"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
    </motion.div>
  );
}
