import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Badge, Card } from '@mentra/ui';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

export type Feature = { icon: ReactNode; title: string; desc: string };

/** Polished landing for a module that's on the roadmap but not yet built out. */
export function FeaturePreview({
  icon,
  title,
  tagline,
  description,
  features,
}: {
  icon: ReactNode;
  title: string;
  tagline: string;
  description: string;
  features: Feature[];
}) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto w-full max-w-8xl"
    >
      <motion.div variants={fadeUp} className="flex items-start gap-3 sm:gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-surface-inverse text-ink-inverse [&_svg]:size-6 sm:size-14 sm:[&_svg]:size-7">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-display-sm tracking-normal sm:text-display-md">{title}</h1>
            <Badge variant="outline" size="md">In development</Badge>
          </div>
          <p className="mt-1 text-sm font-medium text-accent-amber">{tagline}</p>
        </div>
      </motion.div>

      <motion.p variants={fadeUp} className="mt-5 max-w-2xl text-sm leading-7 text-ink-muted">
        {description}
      </motion.p>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <motion.div key={f.title} variants={fadeUp}>
            <Card className="h-full">
              <span className="mb-3 grid size-10 place-items-center rounded-md bg-surface-sunken text-ink ring-1 ring-border-subtle">
                {f.icon}
              </span>
              <div className="text-sm font-semibold text-ink">{f.title}</div>
              <p className="mt-1 text-sm leading-6 text-ink-muted">{f.desc}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div variants={fadeUp} className="mt-7 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/roadmap')}
          className="h-10 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse transition hover:bg-ink"
        >
          Continue your roadmap
        </button>
        <span className="text-xs text-ink-faint">This module is coming soon — your roadmap keeps you moving in the meantime.</span>
      </motion.div>
    </motion.div>
  );
}
