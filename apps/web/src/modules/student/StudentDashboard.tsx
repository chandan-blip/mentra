import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Briefcase,
  CalendarClock,
  Check,
  Compass,
  Flame,
  FolderGit2,
  GraduationCap,
  Heart,
  MessageCircle,
  Radio,
  Sparkles,
  Target,
  Trophy,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { DashboardRecommendation, LiveSessionView, PublicProfileCardView, RoadmapView } from '@mentra/shared';
import { Avatar, Badge, Card } from '@mentra/ui';
import { useAckRecommendation, useDashboardOverview } from '../../lib/dashboard.js';
import { useEnrollLiveSession, useUpcomingOpen } from '../../lib/live.js';
import { useRoadmap } from '../../lib/roadmap.js';
import { useProfile } from '../../lib/profile.js';
import { useLearningProgress } from '../../lib/learning.js';
import { useDirectory, useToggleFollow } from '../../lib/profile.js';
import { useActivityFocus, useActivitySummary } from '../../lib/activity.js';
import { resolveAvatarUrl } from '../../lib/auth.js';
import { ProgressRing } from '../../components/ProgressRing.js';
import { WeeklyProgressChart, type WeekProgress } from '../../components/WeeklyProgressChart.js';
import { ActivityHeatmap } from '../../components/ActivityHeatmap.js';
import { BlackHoleTransition } from '../../components/BlackHoleTransition.js';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

const GREEN = '#22c55e';
const BLUE = '#3b82f6';
const AMBER = '#f59e0b';

const GOAL_LABELS: Record<string, string> = {
  first_job: 'Land first job',
  switch_company: 'Switch company',
  fang_prep: 'FAANG ready',
  startup_join: 'Join a startup',
  freelance: 'Go freelance',
  upskill: 'Level up',
};

function goalLabel(goal: string | null | undefined): string {
  return (goal && GOAL_LABELS[goal]) || 'Job-ready';
}

function monthYear(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function StudentDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data, isLoading } = useDashboardOverview();
  const { data: roadmap } = useRoadmap();
  const { data: profileMe } = useProfile();
  const ack = useAckRecommendation();

  // Warp transitions: "out" when diving into the manifesto, "in" when the user
  // arrives back here through the black hole (flagged via navigation state).
  const [warping, setWarping] = useState(false);
  const [arriving, setArriving] = useState(() => Boolean((location.state as { warp?: boolean } | null)?.warp));

  const assignment = data?.assignment;
  const nextSteps = data?.nextSteps ?? [];

  function onRec(rec: DashboardRecommendation) {
    if (!rec.cta) return;
    ack.mutate({ recId: rec.recId, action: 'clicked' });
    navigate(rec.cta.href);
  }

  if (isLoading) {
    return (
      <>
        <div className="grid min-h-[60vh] place-items-center text-ink-muted">Loading…</div>
        {arriving && <BlackHoleTransition direction="in" onComplete={() => setArriving(false)} />}
      </>
    );
  }

  const firstName = (data?.profile.name ?? 'there').trim().split(/\s+/)[0];

  return (
    <>
    <motion.div
      animate={
        warping
          ? { scale: 0.04, rotateX: 55, rotateZ: 28, z: -700, filter: 'blur(14px)', opacity: 0 }
          : { scale: 1, rotateX: 0, rotateZ: 0, z: 0, filter: 'blur(0px)', opacity: 1 }
      }
      transition={{ duration: 1.6, ease: [0.6, 0, 0.85, 0.25] }}
      style={{ transformOrigin: 'center center', transformPerspective: 1200 }}
    >
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto w-full max-w-8xl space-y-4"
    >
      <motion.div variants={fadeUp} className="hidden sm:block">
        <h1 className="text-display-md tracking-normal">Welcome back, {firstName}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Here&apos;s how far you&apos;ve come — and where to focus next.
        </p>
      </motion.div>

      {/* Upcoming live sessions — kept at the top; enroll (like + "Enrolled!" comment) inline */}
      <motion.div variants={fadeUp}><UpcomingSessionsCard /></motion.div>

      {/* Progress journey: where you started → where you are now → your goal. */}
      <motion.div variants={fadeUp}>
        <JourneyBand
          memberSince={data?.profile.memberSince}
          assignment={assignment}
          roadmap={roadmap}
          goal={profileMe?.profile.goal}
        />
      </motion.div>

      {/* Graphical stat tiles — single stacked column on phones, 2-up at sm, 4-up at lg. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div variants={fadeUp}><RoadmapRingTile roadmap={roadmap} /></motion.div>
        <motion.div variants={fadeUp}><StreakRingTile /></motion.div>
        <motion.div variants={fadeUp}><LearningRingTile /></motion.div>
        <motion.div variants={fadeUp}><CalibrationRingTile assignment={assignment} /></motion.div>
      </div>

      {/* Weekly plan (over time) + where to focus (AI) */}
      <div className="grid grid-cols-12 gap-4">
        <motion.div className="col-span-12 lg:col-span-7" variants={fadeUp}>
          <WeeklyProgressCard roadmap={roadmap} />
        </motion.div>
        <motion.div className="col-span-12 lg:col-span-5" variants={fadeUp}>
          <FocusCard />
        </motion.div>
      </div>

      {/* Activity — streak stats + contribution heatmap */}
      <motion.div variants={fadeUp}><ActivityCard /></motion.div>

      {/* Next steps + discover people */}
      <div className="grid grid-cols-12 gap-4">
        <motion.div className="col-span-12 lg:col-span-7" variants={fadeUp}>
          <Card padding="sm" className="h-full">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium text-ink">Next steps</h3>
              <Badge variant="outline" size="md">For you</Badge>
            </div>
            {nextSteps.length === 0 ? (
              <p className="text-sm text-ink-muted">You&apos;re all caught up — nice work.</p>
            ) : (
              <div className="space-y-3">
                {nextSteps.map((rec, i) => (
                  <RecRow key={rec.recId} rec={rec} index={i + 1} onClick={() => onRec(rec)} />
                ))}
              </div>
            )}
          </Card>
        </motion.div>
        <motion.div className="col-span-12 lg:col-span-5" variants={fadeUp}>
          <PeopleToFollow />
        </motion.div>
      </div>
    </motion.div>
    </motion.div>

    {!warping && (
      <div className="fixed inset-x-0 bottom-6 z-40 hidden justify-center md:flex">
        <ManifestoCta onWarp={() => setWarping(true)} />
      </div>
    )}

    {arriving && <BlackHoleTransition direction="in" onComplete={() => setArriving(false)} />}
    {warping && (
      <BlackHoleTransition
        direction="out"
        onComplete={() => navigate('/manifesto', { state: { warp: true } })}
      />
    )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Progress journey                                                   */
/* ------------------------------------------------------------------ */

type StageState = 'done' | 'current' | 'upcoming';

/**
 * The narrative arc of a student's progress, adaptive to how far along they are. There is no
 * stored skills baseline, so "where you started" is honestly framed as join date + the one-time
 * assignment calibration score; "now" is live roadmap progress; the last node is their stated goal.
 * Brand-new users see the same band with the current stage as an actionable CTA — so it's relevant
 * whether they just onboarded or have been here for months.
 */
function JourneyBand({
  memberSince,
  assignment,
  roadmap,
  goal,
}: {
  memberSince: string | null | undefined;
  assignment: { status: 'ready' | 'completed' | null; score: number | null } | undefined;
  roadmap: RoadmapView | null | undefined;
  goal: string | null | undefined;
}) {
  const navigate = useNavigate();
  const assignmentDone = assignment?.status === 'completed';
  const hasRoadmap = Boolean(roadmap);
  const pct = roadmap?.percentComplete ?? 0;

  // Exactly one "current" stage — the user's real position in the arc.
  const currentIndex = !assignmentDone ? 1 : pct >= 100 ? 3 : 2;
  const stateFor = (i: number): StageState =>
    i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming';

  // Connecting-line fill: onboarded → calibrated → (roadmap %) → goal.
  const journeyPct = !assignmentDone ? 8 : pct >= 100 ? 100 : hasRoadmap ? 33 + Math.round((pct / 100) * 64) : 33;

  const stages: { label: string; sub: string; icon: typeof Check; state: StageState }[] = [
    { label: 'Onboarded', sub: monthYear(memberSince), icon: Check, state: stateFor(0) },
    {
      label: 'Calibrated',
      sub: assignmentDone ? `${assignment?.score ?? 0}% score` : 'Pending',
      icon: Target,
      state: stateFor(1),
    },
    {
      label: 'Building',
      sub: hasRoadmap ? `${pct}% done` : 'Locked',
      icon: Compass,
      state: stateFor(2),
    },
    { label: goalLabel(goal), sub: pct >= 100 ? 'Reached' : 'Your goal', icon: Trophy, state: stateFor(3) },
  ];

  const cta = !assignmentDone
    ? { label: 'Start assignment', href: '/assignment' }
    : !hasRoadmap
      ? { label: 'View roadmap', href: '/roadmap' }
      : pct >= 100
        ? { label: 'Explore projects', href: '/projects' }
        : { label: 'Continue roadmap', href: '/roadmap' };

  return (
    <Card padding="sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Sparkles className="size-4 text-accent-amber" /> Your journey
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">From day one to {goalLabel(goal).toLowerCase()}.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(cta.href)}
          className="group flex h-9 shrink-0 items-center gap-2 rounded-md bg-surface-inverse px-4 text-xs font-semibold text-ink-inverse transition hover:bg-ink"
        >
          {cta.label}
          <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
        </button>
      </div>

      <div className="relative">
        {/* base + filled connecting line, centered on the 40px nodes (top-5 = 20px) */}
        <div className="absolute left-[12.5%] right-[12.5%] top-5 h-0.5 -translate-y-1/2 rounded-full bg-border-subtle" />
        <motion.div
          className="absolute left-[12.5%] top-5 h-0.5 -translate-y-1/2 rounded-full bg-accent-green"
          initial={{ width: 0 }}
          animate={{ width: `${(journeyPct / 100) * 75}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        />
        <div className="relative grid grid-cols-4">
          {stages.map((s) => (
            <StageNode key={s.label} {...s} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function StageNode({
  label,
  sub,
  icon: Icon,
  state,
}: {
  label: string;
  sub: string;
  icon: typeof Check;
  state: StageState;
}) {
  const dot =
    state === 'done'
      ? 'bg-accent-green text-black'
      : state === 'current'
        ? 'bg-accent-blue text-white ring-4 ring-accent-blue/20'
        : 'bg-surface-sunken text-ink-faint ring-1 ring-border-subtle';
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className={`grid size-10 place-items-center rounded-full [&_svg]:size-5 ${dot}`}>
        <Icon />
      </span>
      <div className="min-w-0">
        <div className={`truncate text-xs font-semibold ${state === 'upcoming' ? 'text-ink-muted' : 'text-ink'}`}>
          {label}
        </div>
        <div className="truncate text-[11px] text-ink-faint">{sub}</div>
      </div>
    </div>
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

function RoadmapRingTile({ roadmap }: { roadmap: RoadmapView | null | undefined }) {
  const pct = roadmap?.percentComplete ?? 0;
  return (
    <RingTile
      value={pct}
      color={GREEN}
      center={`${pct}%`}
      title="Roadmap"
      sub={roadmap ? `Week ${roadmap.currentWeek} · ${roadmap.completedItems}/${roadmap.totalItems}` : 'Locked'}
    />
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

function CalibrationRingTile({
  assignment,
}: {
  assignment: { status: 'ready' | 'completed' | null; score: number | null } | undefined;
}) {
  const done = assignment?.status === 'completed';
  const score = assignment?.score ?? 0;
  return (
    <RingTile
      value={done ? score : 0}
      color="#f5f5f5"
      center={done ? `${score}%` : '—'}
      title="Calibration"
      sub={done ? 'Assignment score' : 'Take assignment'}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Weekly progress                                                    */
/* ------------------------------------------------------------------ */

function WeeklyProgressCard({ roadmap }: { roadmap: RoadmapView | null | undefined }) {
  if (!roadmap) {
    return (
      <Card padding="sm" className="flex h-full flex-col">
        <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
          <Compass className="size-4" /> Weekly plan
        </h3>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          Your personalized week-by-week plan appears here once you complete your assignment.
        </p>
      </Card>
    );
  }

  const weeks: WeekProgress[] = roadmap.weeks.map((w) => ({
    weekNumber: w.weekNumber,
    total: w.items.length,
    completed: w.items.filter((it) => it.status === 'completed').length,
  }));

  return (
    <Card padding="sm" className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
          <Compass className="size-4" /> Weekly plan
        </h3>
        <Link
          to="/roadmap"
          className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-ink"
        >
          Open roadmap <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <WeeklyProgressChart weeks={weeks} currentWeek={roadmap.currentWeek} />
      <div className="mt-3 flex items-center gap-4 text-[11px] text-ink-faint">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-accent-green" /> Completed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-surface-sunken ring-1 ring-border-subtle" /> Remaining
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm ring-1 ring-accent-blue" /> This week
        </span>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Upcoming live sessions                                             */
/* ------------------------------------------------------------------ */

function formatWhen(iso: string | null): string {
  if (!iso) return 'Time to be announced';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Time to be announced';
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * All upcoming mentor sessions with an inline Enroll button — the same action as the
 * chat's enroll card: enrolling likes the session and posts an "Enrolled!" comment.
 */
function UpcomingSessionsCard() {
  const navigate = useNavigate();
  const { data, isLoading } = useUpcomingOpen();
  const enroll = useEnrollLiveSession();
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const sessions = data ?? [];

  if (isLoading || sessions.length === 0) return null;

  // Enroll, then open the session's watch page.
  async function onEnroll(id: string) {
    setEnrollingId(id);
    try {
      await enroll.mutateAsync(id);
      navigate(`/live-sessions/${id}`);
    } finally {
      setEnrollingId(null);
    }
  }

  return (
    <Card padding="sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
          <Radio className="size-4" /> Upcoming sessions
        </h3>
        <Link
          to="/live-sessions"
          className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-ink"
        >
          View all <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sessions.map((s) => (
          <UpcomingSessionRow
            key={s.id}
            session={s}
            pending={enrollingId === s.id}
            onEnroll={() => onEnroll(s.id)}
            onOpen={() => navigate(`/live-sessions/${s.id}`)}
          />
        ))}
      </div>
    </Card>
  );
}

function UpcomingSessionRow({
  session: s,
  pending,
  onEnroll,
  onOpen,
}: {
  session: LiveSessionView;
  pending: boolean;
  onEnroll: () => void;
  onOpen: () => void;
}) {
  const enrolled = s.likedByViewer;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}
      className="flex cursor-pointer flex-col gap-3 rounded-lg bg-surface-sunken p-3 ring-1 ring-border-subtle transition hover:ring-border-strong"
    >
      <div className="flex items-center gap-2.5">
        <Avatar src={resolveAvatarUrl(s.mentorAvatarUrl)} name={s.mentorName} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-ink">{s.mentorName}</div>
          <div className="text-[11px] uppercase tracking-wide text-accent-green">Live session</div>
        </div>
      </div>

      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-ink">{s.title}</div>
        <div className="truncate text-xs text-ink-muted">{s.topic}</div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="size-3.5" />
          {formatWhen(s.scheduledFor)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Heart className="size-3.5" />
          {s.likeCount}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="size-3.5" />
          {s.chatCount}
        </span>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (enrolled) onOpen();
          else onEnroll();
        }}
        disabled={pending}
        className={`mt-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-semibold transition disabled:opacity-60 ${
          enrolled
            ? 'bg-surface text-accent-green ring-1 ring-border-subtle hover:ring-border-strong'
            : 'bg-accent-blue text-white hover:brightness-110'
        }`}
      >
        {enrolled ? (
          <>
            <Check className="size-4" /> Enrolled
          </>
        ) : pending ? (
          'Enrolling…'
        ) : (
          'Enroll'
        )}
      </button>
    </div>
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
/* Where to focus (unchanged behavior, AI-driven)                     */
/* ------------------------------------------------------------------ */

/** Pick an icon hinting at where a focus item leads, so each row reads at a glance. */
function focusIcon(href: string | null): typeof Target {
  if (!href) return Sparkles;
  if (href.startsWith('/roadmap')) return Compass;
  if (href.startsWith('/learning')) return GraduationCap;
  if (href.startsWith('/projects')) return FolderGit2;
  if (href.startsWith('/assignment')) return Sparkles;
  if (href.startsWith('/jobs') || href.startsWith('/hr-jobs')) return Briefcase;
  if (href.startsWith('/live-sessions') || href.startsWith('/mentor')) return Video;
  return Target;
}

/**
 * "Where to focus" — the AI-generated (Groq, cached) guidance built from the student's activity
 * signals. Falls back to rule-based tips if the model is down. Rendered graphically: a bullseye
 * header, a lead headline on an accent rail, a destination icon per item, and a highlighted
 * top-priority row — the focus items carry no numeric magnitude, so this is visual emphasis
 * (icons + ranking) rather than a fabricated chart.
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

/* ------------------------------------------------------------------ */
/* Recommendations + discovery (kept)                                 */
/* ------------------------------------------------------------------ */

function RecRow({ rec, index, onClick }: { rec: DashboardRecommendation; index: number; onClick: () => void }) {
  const interactive = Boolean(rec.cta);
  const inner = (
    <>
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-inverse text-xs font-semibold text-ink-inverse">{index}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink">{rec.title}</div>
        <div className="mt-1 text-xs leading-5 text-ink-muted">{rec.body}</div>
      </div>
      {rec.cta ? <ArrowRight className="size-4 shrink-0 self-center text-ink-faint" /> : null}
    </>
  );
  const cls = 'flex w-full gap-3 rounded-md bg-surface-sunken p-3 text-left ring-1 ring-border-subtle';
  return interactive ? (
    <button type="button" onClick={onClick} className={`${cls} transition hover:ring-border-strong`}>{inner}</button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/**
 * Discovery widget — a few suggested students (most-followed first, from the
 * directory) with inline follow buttons and a link to browse everyone.
 */
function PeopleToFollow() {
  const { data, isLoading } = useDirectory('');
  const people = (data ?? []).slice(0, 4);

  if (isLoading || people.length === 0) return null;

  return (
    <Card padding="sm" className="h-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
          <Users className="size-4" /> People to follow
        </h3>
        <Link to="/students" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-ink">
          Browse all <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <div className="space-y-3">
        {people.map((p) => (
          <SuggestedStudent key={p.userId} student={p} />
        ))}
      </div>
    </Card>
  );
}

function SuggestedStudent({ student: s }: { student: PublicProfileCardView }) {
  const toggle = useToggleFollow(s.userId);
  const following = s.isFollowedByViewer;

  return (
    <div className="flex items-center gap-3 rounded-md bg-surface-sunken p-3 ring-1 ring-border-subtle">
      <Link to={`/students/${s.userId}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar src={resolveAvatarUrl(s.avatarUrl)} name={s.name} size="md" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{s.name}</div>
          {s.headline ? <div className="truncate text-xs text-ink-faint">{s.headline}</div> : null}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => toggle.mutate(!following)}
        disabled={toggle.isPending}
        aria-label={following ? `Unfollow ${s.name}` : `Follow ${s.name}`}
        className={[
          'flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold transition disabled:opacity-50',
          following
            ? 'bg-surface text-ink ring-1 ring-border-subtle hover:ring-border-strong'
            : 'bg-surface-inverse text-ink-inverse hover:bg-ink',
        ].join(' ')}
      >
        {following ? <Check className="size-3.5" /> : <UserPlus className="size-3.5" />}
        {following ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}

/**
 * Black-and-white glowing gradient-border button that opens the full-screen
 * Manifesto experience. Mirrors the manifesto's monochrome aesthetic.
 */
function ManifestoCta({ onWarp }: { onWarp: () => void }) {
  return (
    <button
      type="button"
      onClick={onWarp}
      className="group relative rounded-full bg-gradient-to-r from-neutral-900 via-neutral-400 to-neutral-900 p-[1.5px] shadow-[0_0_25px_rgba(0,0,0,0.2)] transition hover:shadow-[0_0_45px_rgba(0,0,0,0.4)]"
    >
      {/* animated outer glow */}
      <motion.span
        aria-hidden
        className="absolute -inset-1 rounded-full bg-gradient-to-r from-neutral-700 via-white to-neutral-700 blur-lg"
        animate={{ opacity: [0.25, 0.55, 0.25] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span className="relative flex items-center gap-2 rounded-full bg-black px-7 py-3 text-sm font-semibold text-white">
        <Sparkles className="size-4" />
        Read the Manifesto
        <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}
