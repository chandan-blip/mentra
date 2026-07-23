import { motion } from 'framer-motion';
import { Calendar, MessagesSquare, Users } from 'lucide-react';
import { Badge, Card, StatCard } from '@mentra/ui';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

const panels = [
  {
    title: 'Assigned students',
    body: 'Students matched to you for guidance and reviews.',
    phase: 'Phase 3 · 11-mentor-system',
    icon: Users,
  },
  {
    title: 'Upcoming sessions',
    body: 'Your scheduled DSA, mock-interview, and review sessions.',
    phase: 'Phase 3 · 10-live-sessions',
    icon: Calendar,
  },
  {
    title: 'Doubts queue',
    body: 'Questions submitted by students awaiting your answer.',
    phase: 'Phase 3 · 12-mentor-system',
    icon: MessagesSquare,
  },
];

export function MentorDashboard() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto max-w-8xl space-y-5"
    >
      <motion.div variants={fadeUp}>
        <h1 className="text-display-md tracking-normal">Mentor overview</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Your mentoring tools arrive with the Phase&nbsp;3 mentor &amp; live-session modules.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <motion.div variants={fadeUp}><StatCard inverse value="0" label="Assigned students" /></motion.div>
        <motion.div variants={fadeUp}><StatCard value="0" label="Sessions this week" /></motion.div>
        <motion.div variants={fadeUp}><StatCard value="0" label="Open doubts" /></motion.div>
        <motion.div variants={fadeUp}><StatCard value="0" label="Reviews done" /></motion.div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {panels.map((p) => {
          const Icon = p.icon;
          return (
            <motion.div key={p.title} className="col-span-12 sm:col-span-6 lg:col-span-4" variants={fadeUp}>
              <Card className="h-full opacity-80">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-raised text-ink-muted"><Icon className="size-4" /></span>
                  <Badge variant="outline" size="md">Coming soon</Badge>
                </div>
                <h3 className="text-sm font-medium text-ink">{p.title}</h3>
                <p className="mt-1 text-sm leading-6 text-ink-muted">{p.body}</p>
                <div className="mt-3 text-xs text-ink-faint">{p.phase}</div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
