import type { ReactNode } from 'react';

/**
 * Accessible on/off switch — a drop-in replacement for a checkbox. Renders as a
 * `role="switch"` button so an optional inline label toggles it too. Green track when on,
 * neutral track when off; keyboard-focusable with a visible focus ring.
 */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
  className,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`group inline-flex items-center gap-2.5 align-middle text-sm text-ink focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ''}`}
    >
      <span
        aria-hidden
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ink group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-surface ${
          checked ? 'bg-accent-green' : 'bg-surface-sunken ring-1 ring-border'
        }`}
      >
        <span
          className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
      {label != null ? <span className="min-w-0 text-left">{label}</span> : null}
    </button>
  );
}
