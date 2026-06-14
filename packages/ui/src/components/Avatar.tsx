import type { ReactNode } from 'react';
import { cn } from '../cn.js';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  online?: boolean;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
  '2xl': 'h-24 w-24 text-2xl',
};

const dotSizeClasses: Record<AvatarSize, string> = {
  xs: 'h-1.5 w-1.5',
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
  xl: 'h-3.5 w-3.5',
  '2xl': 'h-4 w-4',
};

function initials(name?: string): string {
  if (!name) return '';
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({ src, alt, name, size = 'md', online, className }: AvatarProps) {
  return (
    <div className={cn('relative inline-flex shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={alt ?? name ?? 'avatar'}
          className={cn(
            'rounded-full object-cover ring-1 ring-border',
            sizeClasses[size],
          )}
        />
      ) : (
        <div
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-surface-raised font-medium text-ink',
            'ring-1 ring-border',
            sizeClasses[size],
          )}
        >
          {initials(name)}
        </div>
      )}
      {online && (
        <span
          className={cn(
            'absolute right-0 bottom-0 rounded-full bg-accent-green ring-2 ring-canvas',
            dotSizeClasses[size],
          )}
        />
      )}
    </div>
  );
}

export interface AvatarStackProps {
  avatars: Array<Pick<AvatarProps, 'src' | 'name'>>;
  size?: AvatarSize;
  max?: number;
  extraNode?: ReactNode;
}

export function AvatarStack({ avatars, size = 'sm', max = 5, extraNode }: AvatarStackProps) {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - visible.length;
  return (
    <div className="flex items-center -space-x-2">
      {visible.map((a, i) => (
        <div key={i} className="ring-2 ring-canvas rounded-full">
          <Avatar size={size} src={a.src} name={a.name} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-surface text-ink-muted ring-2 ring-canvas',
            sizeClasses[size],
            'text-xs',
          )}
        >
          +{overflow}
        </div>
      )}
      {extraNode}
    </div>
  );
}
