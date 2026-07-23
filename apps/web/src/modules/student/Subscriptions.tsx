import { motion } from 'framer-motion';
import { Check, Crown, LifeBuoy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card } from '@mentra/ui';
import { useMyAccess, useStudentPlans } from '../../lib/access.js';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

export function SubscriptionsPage() {
  const navigate = useNavigate();
  const { data: access } = useMyAccess();
  const { data: plans, isLoading } = useStudentPlans();

  const currentPlanId = access?.planId ?? plans?.find((p) => p.isDefault)?.id ?? null;
  // Only surface modules this user's role can actually read — hides admin-only
  // (and any other non-student) modules that may be attached to a plan.
  const visibleModules = (keys: string[]) =>
    keys.map((k) => access?.modules.find((m) => m.key === k)).filter((m): m is NonNullable<typeof m> => Boolean(m));

  return (
    <div className="mx-auto w-full max-w-8xl space-y-6">
      {isLoading ? (
        <div className="text-sm text-ink-muted">Loading plans…</div>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {(plans ?? []).map((plan) => {
            const current = plan.id === currentPlanId;
            return (
              <motion.div key={plan.id} variants={fadeUp}>
                <Card className={`flex h-full flex-col ${current ? 'ring-2 ring-accent-green' : ''}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                      {plan.id !== 'free' ? <Crown className="size-4 text-accent-amber" /> : null}
                      {plan.name}
                    </h3>
                    {current ? <Badge variant="outline" size="md">Current</Badge> : null}
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-display-md leading-none">
                      {plan.priceCents === 0 ? 'Free' : `₹${Math.round(plan.priceCents / 100)}`}
                    </span>
                    {plan.priceCents > 0 ? <span className="text-xs text-ink-faint">/ month</span> : null}
                  </div>

                  {plan.description ? (
                    <p className="mt-2 text-sm leading-6 text-ink-muted">{plan.description}</p>
                  ) : null}

                  <ul className="mt-4 space-y-1.5">
                    {visibleModules(plan.moduleKeys).map((m) => (
                      <li key={m.key} className="flex items-center gap-2 text-sm text-ink-muted">
                        <Check className="size-4 shrink-0 text-accent-green" />
                        {m.label}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 pt-2">
                    {current ? (
                      <button
                        type="button"
                        disabled
                        className="h-10 w-full rounded-md bg-surface-sunken text-sm font-medium text-ink-muted ring-1 ring-border-subtle"
                      >
                        Your current plan
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate('/support')}
                        className="h-10 w-full rounded-md bg-surface-inverse text-sm font-semibold text-ink-inverse transition hover:bg-ink"
                      >
                        {plan.priceCents === 0 ? 'Switch to Free' : `Upgrade to ${plan.name}`}
                      </button>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-lg bg-surface-sunken p-4 text-sm text-ink-muted ring-1 ring-border-subtle">
        <LifeBuoy className="mt-0.5 size-4 shrink-0" />
        <span>
          Online billing isn&apos;t live yet. To change your plan, reach out from the{' '}
          <button type="button" onClick={() => navigate('/support')} className="text-ink underline">
            Support
          </button>{' '}
          page and we&apos;ll switch it for you.
        </span>
      </div>
    </div>
  );
}
