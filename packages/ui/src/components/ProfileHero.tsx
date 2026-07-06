import { useEffect, useState, type ReactNode } from 'react';
import { Card } from './Card.js';
import { OnlineDot } from './OnlineDot.js';
import { cn } from '../cn.js';

export interface ProfileHeroProps {
  name: string;
  role?: string;
  avatarUrl?: string;
  /** e.g. "1.2 years of work" */
  experience?: string;
  online?: boolean;
  action?: ReactNode;
  className?: string;
}

/**
 * Large profile card with portrait — matches the Cavin Piterson hero in the theme.
 * Designed for square / 4:5 portrait images on dark background.
 */
export function ProfileHero({
  name,
  role,
  avatarUrl,
  experience,
  online,
  action,
  className,
}: ProfileHeroProps) {
  // Fall back to the gradient placeholder if the portrait fails to load.
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);

  return (
    <Card variant="default" padding={false} className={cn('relative overflow-hidden', className)}>
      {/* Top meta strip */}
      <div className="absolute left-card right-card top-4 z-10 flex items-center justify-between">
        {online && <OnlineDot />}
        {experience && (
          <span className="rounded-full bg-surface-raised/80 px-2.5 py-1 text-[11px] font-medium text-ink-muted ring-1 ring-border-subtle">
            {experience}
          </span>
        )}
      </div>

      {/* Portrait */}
      {avatarUrl && !failed ? (
        <img
          src={avatarUrl}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="aspect-[4/5] w-full object-cover"
        />
      ) : (
        <div className="aspect-[4/5] w-full bg-gradient-to-b from-surface-raised to-surface-sunken" />
      )}

      {/* Bottom name strip */}
      <div className="flex items-end justify-between gap-3 p-card">
        <div className="min-w-0">
          <div className="truncate text-display-sm">{name}</div>
          {role && <div className="mt-1 text-sm text-ink-muted">{role}</div>}
        </div>
        {action}
      </div>
    </Card>
  );
}
