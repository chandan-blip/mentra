import { forwardRef, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../cn.js';

type IconButtonVariant = 'dark' | 'light' | 'ghost';
type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  active?: boolean;
  children: ReactNode;
  label?: string;
}

const variantClasses: Record<IconButtonVariant, string> = {
  dark: 'bg-surface text-ink ring-1 ring-border-subtle hover:bg-surface-raised',
  light: 'bg-surface-inverse text-ink-inverse hover:bg-neutral-100',
  ghost: 'bg-transparent text-ink hover:bg-surface',
};

const sizeClasses: Record<IconButtonSize, string> = {
  sm: 'h-9 w-9 [&_svg]:size-4',
  md: 'h-11 w-11 [&_svg]:size-5',
  lg: 'h-12 w-12 [&_svg]:size-5',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { className, variant = 'dark', size = 'md', active, children, label, ...rest },
    ref,
  ) {
    return (
      <motion.button
        ref={ref}
        type="button"
        aria-label={label}
        whileTap={{ scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        className={cn(
          'inline-flex items-center justify-center rounded-full transition-colors',
          'outline-none focus-visible:ring-2 focus-visible:ring-ink/40',
          variantClasses[variant],
          sizeClasses[size],
          active && 'bg-surface-raised ring-border-strong',
          className,
        )}
        {...rest}
      >
        {children}
      </motion.button>
    );
  },
);
