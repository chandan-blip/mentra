import type { ReactNode } from 'react';
import { Card } from './Card.js';
import { cn } from '../cn.js';

export interface StatCardProps {
  /** Big display number, e.g. "456" */
  value: ReactNode;
  /** Small label below, e.g. "Days in company" */
  label: ReactNode;
  /** Optional tiny suffix (e.g. "days", "%") */
  unit?: string;
  /** Optional small trend or context line */
  hint?: ReactNode;
  /** Inverse (white) card if true */
  inverse?: boolean;
  className?: string;
}

/**
 * Stat card matching the theme — pairs a heavy display number with a faint label.
 * Used for the "456 days in company" / "11 done projects" tiles.
 */
export function StatCard({
  value,
  label,
  unit,
  hint,
  inverse,
  className,
}: StatCardProps) {
  return (
    <Card variant={inverse ? 'inverse' : 'default'} className={cn('flex flex-col', className)}>
      <div
        className={cn(
          'text-display-lg leading-none',
          inverse ? 'text-ink-inverse' : 'text-ink',
        )}
      >
        {value}
        {unit && (
          <span
            className={cn(
              'ml-1 align-baseline text-display-sm',
              inverse ? 'text-ink-inverse-muted' : 'text-ink-muted',
            )}
          >
            {unit}
          </span>
        )}
      </div>
      <div
        className={cn(
          'mt-3 text-sm',
          inverse ? 'text-ink-inverse-muted' : 'text-ink-muted',
        )}
      >
        {label}
      </div>
      {hint && (
        <div
          className={cn(
            'mt-1 text-xs',
            inverse ? 'text-ink-inverse-muted' : 'text-ink-faint',
          )}
        >
          {hint}
        </div>
      )}
    </Card>
  );
}
