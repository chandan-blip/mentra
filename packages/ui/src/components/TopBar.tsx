import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../cn.js';

export interface TopBarProps {
  left?: ReactNode;
  right?: ReactNode;
  /** When provided, renders a search input in the middle */
  searchPlaceholder?: string;
  onSearch?: (q: string) => void;
  className?: string;
}

/**
 * Top utility bar — date + weather on the left, centered search,
 * actions on the right. Matches theme.webp's header layout.
 */
export function TopBar({
  left,
  right,
  searchPlaceholder,
  onSearch,
  className,
}: TopBarProps) {
  return (
    <header
      className={cn(
        'flex w-full items-center justify-between gap-4 px-2 py-3',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-4">{left}</div>

      {searchPlaceholder !== undefined && (
        <div className="hidden flex-1 justify-center md:flex">
          <label
            className={cn(
              'flex h-11 w-full max-w-md items-center gap-2 rounded-full bg-surface px-4 ring-1 ring-border-subtle',
              'focus-within:ring-border-strong',
            )}
          >
            <Search className="size-4 shrink-0 text-ink-muted" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              onChange={(e) => onSearch?.(e.target.value)}
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none"
            />
          </label>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-3">{right}</div>
    </header>
  );
}
