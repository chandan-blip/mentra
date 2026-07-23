import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Briefcase,
  Flame,
  FolderGit2,
  GraduationCap,
  Sparkles,
  Target,
  Video,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Card } from '@mentra/ui';
import { useLearningProgress } from '../../lib/learning.js';
import { useActivityFocus, useActivitySummary } from '../../lib/activity.js';
import { ProgressRing } from '../../components/ProgressRing.js';
import { ActivityHeatmap } from '../../components/ActivityHeatmap.js';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

const BLUE = '#3b82f6';
const AMBER = '#f59e0b';

/**
 * "Your Activity" — the student's self-reflective progress: streaks, learning, an AI "where to
 * focus" panel, and a contribution heatmap. Lives under Settings so the home dashboard stays
 * focused on what's next (sessions, recommendations, people).
 */
export function ActivityTab() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="space-y-4"
    >
      {/* Graphical stat tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <motion.div variants={fadeUp}><StreakRingTile /></motion.div>
        <motion.div variants={fadeUp}><LearningRingTile /></motion.div>
      </div>

      {/* Where to focus (AI) */}
      <motion.div variants={fadeUp}><FocusCard /></motion.div>

      {/* Activity — streak stats + contribution heatmap */}
      <motion.div variants={fadeUp}><ActivityCard /></motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Graphical stat tiles                                               */
/* ------------------------------------------------------------------ */

function RingTile({
  value,
  color,
  center,
  title,
  sub,
}: {
  value: number;
  color: string;
  center: ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <Card padding="sm" className="flex items-center gap-3">
      <ProgressRing value={value} size={64} stroke={7} color={color}>
        <span className="text-sm font-bold text-ink">{center}</span>
      </ProgressRing>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-ink">{title}</div>
        <div className="truncate text-xs text-ink-muted">{sub}</div>
      </div>
    </Card>
  );
}

function StreakRingTile() {
  const { data } = useActivitySummary();
  const streak = data?.currentStreak ?? 0;
  const longest = data?.longestStreak ?? 0;
  const value = longest > 0 ? (streak / longest) * 100 : streak > 0 ? 100 : 0;
  return (
    <RingTile
      value={value}
      color={AMBER}
      center={
        <span className="flex items-center gap-0.5">
          <Flame className="size-3 text-accent-amber" />
          {streak}
        </span>
      }
      title="Day streak"
      sub={longest > 0 ? `Best ${longest} day${longest === 1 ? '' : 's'}` : 'Show up daily'}
    />
  );
}

function LearningRingTile() {
  const { data } = useLearningProgress();
  const categories = data?.categoriesCount ?? 0;
  const completed = data?.seriesCompleted ?? 0;
  const value = categories > 0 ? (completed / categories) * 100 : 0;
  return (
    <RingTile
      value={value}
      color={BLUE}
      center={String(data?.testsPassed ?? 0)}
      title="Learning"
      sub={categories > 0 ? `${completed}/${categories} tracks done` : 'Tests passed'}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Activity                                                           */
/* ------------------------------------------------------------------ */

function ActivityCard() {
  const { data } = useActivitySummary();

  return (
    <Card padding="sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
          <Activity className="size-4" /> Activity
        </h3>
        <Link
          to="/analytics"
          className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-ink"
        >
          View analytics <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat value={data?.todayCount ?? 0} label="Today" />
        <MiniStat value={data?.weekCount ?? 0} label="This week" />
        <MiniStat value={data?.currentStreak ?? 0} label="Streak" />
        <MiniStat value={data?.longestStreak ?? 0} label="Longest" />
      </div>

      <ActivityHeatmap activeDays={data?.activeDays ?? []} />
    </Card>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-md bg-surface-sunken px-3 py-2.5 ring-1 ring-border-subtle">
      <div className="text-display-sm leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-ink-faint">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Where to focus (AI-driven)                                         */
/* ------------------------------------------------------------------ */

/** Pick an icon hinting at where a focus item leads, so each row reads at a glance. */
function focusIcon(href: string | null): typeof Target {
  if (!href) return Sparkles;
  if (href.startsWith('/learning')) return GraduationCap;
  if (href.startsWith('/projects')) return FolderGit2;
  if (href.startsWith('/jobs') || href.startsWith('/hr-jobs')) return Briefcase;
  if (href.startsWith('/live-sessions') || href.startsWith('/mentor')) return Video;
  return Target;
}

/**
 * "Where to focus" — the AI-generated (Groq, cached) guidance built from the student's activity
 * signals. Falls back to rule-based tips if the model is down. Rendered graphically: a bullseye
 * header, a lead headline on an accent rail, a destination icon per item, and a highlighted
 * top-priority row.
 */
function FocusCard() {
  const navigate = useNavigate();
  const { data, isLoading } = useActivityFocus();

  if (isLoading) return <Card padding="sm" className="h-full text-sm text-ink-muted">Analyzing your progress…</Card>;
  if (!data || data.items.length === 0) return null;

  return (
    <Card padding="sm" className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
          <span className="grid size-7 place-items-center rounded-md bg-accent-blue/10 text-accent-blue">
            <Target className="size-4" />
          </span>
          Where to focus
        </h3>
        <Badge variant="outline" size="md">{data.source === 'ai' ? 'AI' : 'For you'}</Badge>
      </div>

      {/* Headline as a lead statement on an accent rail. */}
      <p className="mb-4 border-l-2 border-accent-blue/60 pl-3 text-sm font-semibold leading-6 text-ink">
        {data.headline}
      </p>

      <div className="flex flex-col gap-2">
        {data.items.map((it, i) => {
          const Icon = focusIcon(it.href);
          const isTop = i === 0;
          return (
            <motion.button
              key={i}
              type="button"
              disabled={!it.href}
              onClick={() => it.href && navigate(it.href)}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 26 }}
              className={`group flex w-full items-center gap-3 rounded-lg p-3 text-left ring-1 transition disabled:cursor-default ${
                isTop
                  ? 'bg-accent-blue/[0.07] ring-accent-blue/30 enabled:hover:ring-accent-blue/50'
                  : 'bg-surface-sunken ring-border-subtle enabled:hover:ring-border-strong'
              }`}
            >
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-md [&_svg]:size-5 ${
                  isTop ? 'bg-accent-blue text-white' : 'bg-surface-inverse text-ink-inverse'
                }`}
              >
                <Icon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{it.title}</span>
                  {isTop ? (
                    <span className="shrink-0 rounded-full bg-accent-blue/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-blue">
                      Top
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-ink-muted">{it.reason}</span>
              </span>
              {it.href ? (
                <ArrowRight className="size-4 shrink-0 self-center text-ink-faint transition group-hover:translate-x-0.5" />
              ) : null}
            </motion.button>
          );
        })}
      </div>
    </Card>
  );
}
