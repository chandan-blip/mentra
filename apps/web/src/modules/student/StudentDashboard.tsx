import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Compass, Sparkles, Target, UserPlus, Users } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { DashboardRecommendation, PublicProfileCardView } from '@mentra/shared';
import { Avatar, Badge, Card, StatCard } from '@mentra/ui';
import { useAckRecommendation, useDashboardOverview } from '../../lib/dashboard.js';
import { useAssignmentStatus } from '../../lib/assignment.js';
import { useRoadmapSummary } from '../../lib/roadmap.js';
import { useDirectory, useToggleFollow } from '../../lib/profile.js';
import { useActivityFocus, useActivitySummary } from '../../lib/activity.js';
import { resolveAvatarUrl } from '../../lib/auth.js';
import { BlackHoleTransition } from '../../components/BlackHoleTransition.js';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

export function StudentDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data, isLoading } = useDashboardOverview();
  const { data: roadmap } = useRoadmapSummary();
  const ack = useAckRecommendation();

  // Warp transitions: "out" when diving into the manifesto, "in" when the user
  // arrives back here through the black hole (flagged via navigation state).
  const [warping, setWarping] = useState(false);
  const [arriving, setArriving] = useState(() => Boolean((location.state as { warp?: boolean } | null)?.warp));

  const assignment = data?.assignment;
  const completed = assignment?.status === 'completed';
  const nextSteps = data?.nextSteps ?? [];

  const assignmentValue = completed
    ? `${assignment?.score ?? 0}%`
    : assignment?.status === 'ready'
      ? 'Ready'
      : 'Pending';

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
      className="mx-auto w-full max-w-8xl space-y-6 pb-24"
    >
      {/* Header is hidden on phones to save vertical space; shown at sm+. */}
      <motion.div variants={fadeUp} className="hidden sm:block">
        <h1 className="text-display-md tracking-normal">Overview</h1>
        <p className="mt-1 text-sm text-ink-muted">Your progress at a glance — assignment, roadmap, and what&apos;s next.</p>
      </motion.div>

      <motion.div variants={fadeUp}><AssignmentBanner /></motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <motion.div variants={fadeUp}><StreakStat /></motion.div>
        <motion.div variants={fadeUp}><StatCard value={assignmentValue} label="Assignment" /></motion.div>
        <motion.div variants={fadeUp}><StatCard value={roadmap?.hasRoadmap ? `${roadmap.percentComplete}%` : '—'} label="Roadmap done" /></motion.div>
        <motion.div variants={fadeUp}><StatCard value={roadmap?.hasRoadmap ? `Week ${roadmap.currentWeek}` : '—'} label="Current week" /></motion.div>
      </div>

      {/* AI-driven "where to focus" — reads the activity signals */}
      <motion.div variants={fadeUp}><FocusCard /></motion.div>

      {/* Main row */}
      <div className="grid grid-cols-12 gap-4">
        <motion.div className="col-span-12 lg:col-span-8" variants={fadeUp}>
          <Card className="h-full">
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

        <motion.div className="col-span-12 lg:col-span-4" variants={fadeUp}>
          <RoadmapWidget />
        </motion.div>
      </div>

      {/* Discover other students — connects the dashboard to the social layer */}
      <motion.div variants={fadeUp}><PeopleToFollow /></motion.div>

    </motion.div>
    </motion.div>

    {!warping && (
      <div className="fixed inset-x-0 bottom-6 z-40 hidden justify-center md:flex">
        {/* Floating CTA is desktop-only; on mobile the Manifesto lives in the off-canvas
            menu drawer (added in AppLayout) so it doesn't collide with the bottom nav. */}
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

/**
 * Top-of-dashboard CTA for the personalized assignment. Uses the cheap status
 * endpoint (no AI call) so it can show whether the student still needs to take it.
 * The assignment drives the roadmap, so this is the primary entry point — including
 * for users who onboarded before the AI flow existed.
 */
function AssignmentBanner() {
  const navigate = useNavigate();
  const { data, isLoading } = useAssignmentStatus();
  if (isLoading) return null;

  const completed = data?.status === 'completed';

  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-inverse text-ink-inverse">
          <Sparkles className="size-5" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-ink">
            {completed ? 'Assignment complete' : 'Take your personalized assignment'}
          </h3>
          <p className="mt-1 max-w-xl text-sm leading-6 text-ink-muted">
            {completed
              ? `You scored ${data?.score ?? 0}% on the scored questions. Your roadmap is built from these results.`
              : 'A short AI-built assignment that calibrates your current level and generates your personalized roadmap.'}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => navigate(completed ? '/roadmap' : '/assignment')}
        className="group flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse transition hover:bg-ink"
      >
        {completed ? 'View roadmap' : 'Start assignment'}
        <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
      </button>
    </Card>
  );
}

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

/** Day-streak tile from the activity summary (falls back to 0 while loading). */
function StreakStat() {
  const { data } = useActivitySummary();
  const streak = data?.currentStreak ?? 0;
  return (
    <StatCard
      inverse
      value={String(streak)}
      unit={streak === 1 ? 'day' : 'days'}
      label="Activity streak"
    />
  );
}

/**
 * "Where to focus" — the AI-generated (Groq, cached) guidance built from the
 * student's activity signals. Falls back to rule-based tips if the model is down.
 */
function FocusCard() {
  const navigate = useNavigate();
  const { data, isLoading } = useActivityFocus();

  if (isLoading) return <Card className="text-sm text-ink-muted">Analyzing your progress…</Card>;
  if (!data || data.items.length === 0) return null;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
          <Target className="size-4" /> Where to focus
        </h3>
        <Badge variant="outline" size="md">{data.source === 'ai' ? 'AI' : 'For you'}</Badge>
      </div>
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
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-surface-inverse text-[11px] font-semibold text-ink-inverse">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">{it.title}</span>
              <span className="mt-0.5 block text-xs leading-5 text-ink-muted">{it.reason}</span>
            </span>
            {it.href ? <ArrowRight className="size-4 shrink-0 self-center text-ink-faint" /> : null}
          </button>
        ))}
      </div>
    </Card>
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
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
          <Users className="size-4" /> People to follow
        </h3>
        <Link to="/students" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-ink">
          Browse all <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

function RoadmapWidget() {
  const navigate = useNavigate();
  const { data } = useRoadmapSummary();

  return (
    <Card className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-ink"><Compass className="size-4" /> Roadmap</h3>
        <Badge variant="outline" size="md">{data?.hasRoadmap ? `Week ${data.currentWeek}` : 'Locked'}</Badge>
      </div>
      {data?.hasRoadmap ? (
        <>
          <div className="text-display-sm">{data.percentComplete}%</div>
          <div className="mt-1 text-xs text-ink-muted">{data.completedItems}/{data.totalItems} items · {data.totalWeeks} weeks</div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
            <div className="h-full rounded-full bg-accent-green" style={{ width: `${data.percentComplete}%` }} />
          </div>
          <button
            type="button"
            onClick={() => navigate('/roadmap')}
            className="mt-auto flex h-10 items-center justify-center gap-2 rounded-md bg-surface-sunken px-4 pt-0 text-sm font-medium text-ink ring-1 ring-border-subtle transition hover:ring-border-strong"
          >
            Open roadmap <ArrowRight className="size-4" />
          </button>
        </>
      ) : (
        <p className="text-sm leading-6 text-ink-muted">
          Your personalized weekly plan appears here once you complete your assignment.
        </p>
      )}
    </Card>
  );
}

