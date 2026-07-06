import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Compass, Flame, Sparkles, Target, TrendingUp } from 'lucide-react';
import { Badge, Card, StatCard } from '@mentra/ui';
import type { ActivityEventView } from '@mentra/shared';
import { PageHeader } from '../../components/PageHeader.js';
import { ActivityHeatmap } from '../../components/ActivityHeatmap.js';
import { useDashboardOverview } from '../../lib/dashboard.js';
import { useRoadmapSummary } from '../../lib/roadmap.js';
import { useActivityFocus, useActivitySummary, useActivityTimeline } from '../../lib/activity.js';
import { formatAgo } from '../../lib/community.js';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

export function AnalyticsPage() {
  const { data, isLoading } = useDashboardOverview();
  const { data: roadmap } = useRoadmapSummary();
  const { data: summary } = useActivitySummary();

  const assignment = data?.assignment;
  const completed = assignment?.status === 'completed';

  if (isLoading) {
    return <div className="grid min-h-[60vh] place-items-center text-ink-muted">Loading…</div>;
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto w-full max-w-8xl space-y-6"
    >
      <motion.div variants={fadeUp}>
        <PageHeader
          icon={<TrendingUp />}
          title="Analytics"
          subtitle="Your activity, momentum, and where to focus next."
        />
      </motion.div>

      {/* Top stats — activity + learning */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <motion.div variants={fadeUp}>
          <StatCard inverse value={String(summary?.currentStreak ?? 0)} unit="days" label="Activity streak" />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard value={String(summary?.weekCount ?? 0)} label="Actions this week" />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard value={roadmap?.hasRoadmap ? `${roadmap.percentComplete}%` : '—'} label="Roadmap complete" />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard value={completed ? `${assignment?.score ?? 0}%` : '—'} label="Assignment score" />
        </motion.div>
      </div>

      {/* Activity heatmap */}
      <motion.div variants={fadeUp}>
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
              <Activity className="size-4" /> Activity — last 12 weeks
            </h3>
            <div className="flex items-center gap-3 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5"><Flame className="size-3.5 text-accent-amber" /> {summary?.currentStreak ?? 0}-day streak</span>
              <span className="hidden sm:inline">Longest: {summary?.longestStreak ?? 0}</span>
            </div>
          </div>
          <ActivityHeatmap activeDays={summary?.activeDays ?? []} />
          <div className="mt-3 flex items-center justify-between text-xs text-ink-faint">
            <span>{summary?.todayCount ?? 0} today · {summary?.weekCount ?? 0} this week</span>
            <span className="flex items-center gap-1">
              Less
              <span className="size-2.5 rounded-sm bg-surface-sunken" />
              <span className="size-2.5 rounded-sm bg-accent-green/30" />
              <span className="size-2.5 rounded-sm bg-accent-green/60" />
              <span className="size-2.5 rounded-sm bg-accent-green" />
              More
            </span>
          </div>
        </Card>
      </motion.div>

      {/* Focus + timeline */}
      <div className="grid grid-cols-12 gap-4">
        <motion.div className="col-span-12 lg:col-span-6" variants={fadeUp}><FocusCard /></motion.div>
        <motion.div className="col-span-12 lg:col-span-6" variants={fadeUp}><ActivityTimeline /></motion.div>
      </div>

      {/* Roadmap + milestones */}
      <div className="grid grid-cols-12 gap-4">
        <motion.div className="col-span-12 lg:col-span-7" variants={fadeUp}>
          <Card className="h-full">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-medium text-ink"><TrendingUp className="size-4" /> Roadmap progress</h3>
              <Badge variant="outline" size="md">{roadmap?.hasRoadmap ? `Week ${roadmap.currentWeek}` : 'Not started'}</Badge>
            </div>
            {roadmap?.hasRoadmap ? (
              <>
                <div className="text-display-md">{roadmap.percentComplete}%</div>
                <div className="mt-1 text-xs text-ink-muted">{roadmap.completedItems} of {roadmap.totalItems} items · {roadmap.totalWeeks} weeks</div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-sunken">
                  <div className="h-full rounded-full bg-accent-green" style={{ width: `${roadmap.percentComplete}%` }} />
                </div>
              </>
            ) : (
              <p className="text-sm leading-6 text-ink-muted">
                Complete your assignment to generate a roadmap — your weekly progress will chart here.
              </p>
            )}
          </Card>
        </motion.div>

        <motion.div className="col-span-12 lg:col-span-5" variants={fadeUp}>
          <Card className="h-full">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-ink"><Target className="size-4" /> Milestones</h3>
            <div className="space-y-2.5">
              <Milestone icon={<Sparkles className="size-4" />} label="Assignment completed" done={completed} />
              <Milestone icon={<Compass className="size-4" />} label="Roadmap generated" done={Boolean(roadmap?.hasRoadmap)} />
              <Milestone icon={<TrendingUp className="size-4" />} label="First roadmap item done" done={(roadmap?.completedItems ?? 0) > 0} />
              <Milestone icon={<Target className="size-4" />} label="Halfway through roadmap" done={(roadmap?.percentComplete ?? 0) >= 50} />
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

/** AI "where to focus" (shared concept with the dashboard, sized for the wide card). */
function FocusCard() {
  const navigate = useNavigate();
  const { data, isLoading } = useActivityFocus();

  return (
    <Card className="h-full">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-ink"><Target className="size-4" /> Where to focus</h3>
        {data ? <Badge variant="outline" size="md">{data.source === 'ai' ? 'AI' : 'For you'}</Badge> : null}
      </div>
      {isLoading ? (
        <p className="text-sm text-ink-muted">Analyzing your progress…</p>
      ) : !data || data.items.length === 0 ? (
        <p className="text-sm text-ink-muted">Do a bit more and personalized guidance will appear here.</p>
      ) : (
        <>
          <p className="mb-3 text-sm font-semibold text-ink">{data.headline}</p>
          <div className="space-y-2">
            {data.items.map((it, i) => (
              <button
                key={i}
                type="button"
                disabled={!it.href}
                onClick={() => it.href && navigate(it.href)}
                className="flex w-full items-start gap-3 rounded-md bg-surface-sunken p-3 text-left ring-1 ring-border-subtle transition enabled:hover:ring-border-strong disabled:cursor-default"
              >
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-surface-inverse text-[11px] font-semibold text-ink-inverse">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{it.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-ink-muted">{it.reason}</span>
                </span>
                {it.href ? <ArrowRight className="size-4 shrink-0 self-center text-ink-faint" /> : null}
              </button>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function ActivityTimeline() {
  const { data, isLoading } = useActivityTimeline(20);

  return (
    <Card className="h-full">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-ink"><Activity className="size-4" /> Recent activity</h3>
      {isLoading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="text-sm text-ink-muted">No activity recorded yet — it’ll appear here as you use Mentra.</p>
      ) : (
        <div className="-my-1 divide-y divide-border-subtle">
          {data!.map((e) => (
            <TimelineRow key={e.id} event={e} />
          ))}
        </div>
      )}
    </Card>
  );
}

function TimelineRow({ event: e }: { event: ActivityEventView }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="size-1.5 shrink-0 rounded-full bg-accent-green" />
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{e.title}</span>
      {e.source !== 'server' ? <Badge variant="outline" size="sm">{e.source}</Badge> : null}
      <span className="shrink-0 text-xs text-ink-faint">{formatAgo(e.occurredAt)}</span>
    </div>
  );
}

function Milestone({ icon, label, done }: { icon: React.ReactNode; label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-surface-sunken p-3 ring-1 ring-border-subtle">
      <span className={`grid size-7 place-items-center rounded-md ${done ? 'bg-accent-green/15 text-accent-green' : 'bg-surface text-ink-faint'}`}>{icon}</span>
      <span className={`text-sm ${done ? 'text-ink' : 'text-ink-muted'}`}>{label}</span>
      {done ? <span className="ml-auto text-xs font-medium text-accent-green">Done</span> : null}
    </div>
  );
}
