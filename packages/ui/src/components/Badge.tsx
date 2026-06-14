import type { ReactNode } from 'react';
import { cn } from '../cn.js';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-raised text-ink ring-1 ring-border',
  success: 'bg-accent-green/15 text-accent-green ring-1 ring-accent-green/30',
  warning: 'bg-accent-amber/15 text-accent-amber ring-1 ring-accent-amber/30',
  danger: 'bg-accent-red/15 text-accent-red ring-1 ring-accent-red/30',
  info: 'bg-accent-blue/15 text-accent-blue ring-1 ring-accent-blue/30',
  outline: 'bg-transparent text-ink-muted ring-1 ring-border',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-xs',
};

export function Badge({ variant = 'default', size = 'sm', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </span>
  );
}
