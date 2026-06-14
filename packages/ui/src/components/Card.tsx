import { forwardRef, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../cn.js';

type CardVariant = 'default' | 'inverse' | 'sunken' | 'raised';

export interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  variant?: CardVariant;
  /** Apply hover lift effect. Default true on default/raised, off elsewhere. */
  interactive?: boolean;
  /** Generous padding by default; pass `padding={false}` for raw control. */
  padding?: boolean | 'sm' | 'md' | 'lg';
  children?: ReactNode;
}

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-surface text-ink ring-1 ring-border-subtle',
  raised: 'bg-surface-raised text-ink ring-1 ring-border',
  sunken: 'bg-surface-sunken text-ink ring-1 ring-border-subtle',
  inverse: 'bg-surface-inverse text-ink-inverse ring-1 ring-black/5',
};

const paddingClasses: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'p-4',
  md: 'p-card',
  lg: 'p-card-lg',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant = 'default', interactive, padding = 'md', children, ...rest },
  ref,
) {
  const resolvedPadding =
    padding === false ? '' : paddingClasses[padding === true ? 'md' : padding];
  const lift =
    interactive ?? (variant === 'default' || variant === 'raised');

  return (
    <motion.div
      ref={ref}
      whileHover={lift ? { y: -2 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={cn(
        'rounded-lg',
        variantClasses[variant],
        resolvedPadding,
        lift && 'cursor-default transition-shadow hover:shadow-card-hover',
        className,
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
});
