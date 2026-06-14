import { cn } from '../cn.js';

export interface OnlineDotProps {
  label?: string;
  className?: string;
}

export function OnlineDot({ label = 'Online', className }: OnlineDotProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-surface-raised/80 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-ink-muted ring-1 ring-border-subtle',
        className,
      )}
    >
      <span className="relative inline-flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-accent-green/60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-green" />
      </span>
      {label}
    </span>
  );
}
