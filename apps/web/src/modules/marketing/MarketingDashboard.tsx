import { motion } from 'framer-motion';
import { Send, Tag, TrendingUp, Users } from 'lucide-react';
import { Badge, Card, StatCard } from '@mentra/ui';

/**
 * Marketing overview — the landing dashboard for users with the `marketing` role.
 * Stats + feature panels are placeholders for now; the rest of the marketing module
 * (campaigns, referrals, etc.) lands in follow-up passes.
 */

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

const panels = [
  { title: 'Campaigns', body: 'Plan and track email & in-app campaigns to learners.', icon: Send },
  { title: 'Audience', body: 'Segment users by role, plan, and activity for targeting.', icon: Users },
  { title: 'Promotions', body: 'Create discount codes and seasonal plan offers.', icon: Tag },
  { title: 'Funnel analytics', body: 'Signups → onboarding → paid conversion, end to end.', icon: TrendingUp },
];

export function MarketingDashboard() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto max-w-8xl space-y-5"
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <motion.div variants={fadeUp}><StatCard inverse value="0" label="Active campaigns" /></motion.div>
        <motion.div variants={fadeUp}><StatCard value="0" label="Reach this month" /></motion.div>
        <motion.div variants={fadeUp}><StatCard value="0" label="Signups" /></motion.div>
        <motion.div variants={fadeUp}><StatCard value="0%" label="Conversion" /></motion.div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {panels.map((p) => {
          const Icon = p.icon;
          return (
            <motion.div key={p.title} className="col-span-12 sm:col-span-6 lg:col-span-3" variants={fadeUp}>
              <Card className="h-full opacity-80">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-raised text-ink-muted"><Icon className="size-4" /></span>
                  <Badge variant="outline" size="md">Coming soon</Badge>
                </div>
                <h3 className="text-sm font-medium text-ink">{p.title}</h3>
                <p className="mt-1 text-sm leading-6 text-ink-muted">{p.body}</p>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
