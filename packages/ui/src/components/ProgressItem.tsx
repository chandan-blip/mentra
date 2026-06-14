import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../cn.js';

export interface ProgressItemProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  /** Right-aligned value, e.g. "+$600" or "5 hours" */
  value?: ReactNode;
  inverseIcon?: boolean;
  onClick?: () => void;
}

/**
 * One row in a vertical "progress" list — matches the theme's
 * User Testing / Interviews / A/B Testing list pattern.
 */
export function ProgressItem({
  icon,
  title,
  subtitle,
  value,
  inverseIcon,
  onClick,
}: ProgressItemProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ x: 2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={cn(
        'group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left',
        'transition-colors hover:bg-surface-raised',
      )}
    >
      <span
        className={cn(
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
          inverseIcon
            ? 'bg-surface-inverse text-ink-inverse'
            : 'bg-surface-raised text-ink',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{title}</span>
        {subtitle && (
          <span className="block truncate text-xs text-ink-muted">{subtitle}</span>
        )}
      </span>
      {value && (
        <span className="shrink-0 text-sm font-medium text-ink">{value}</span>
      )}
    </motion.button>
  );
}
