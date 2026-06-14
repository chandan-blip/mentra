import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Compass, Sparkles } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { DashboardRecommendation } from '@mentra/shared';
import { Badge, Card, StatCard } from '@mentra/ui';
import { useAckRecommendation, useDashboardOverview } from '../../lib/dashboard.js';
import { useAssignmentStatus } from '../../lib/assignment.js';
import { useRoadmapSummary } from '../../lib/roadmap.js';
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
  const stats = data?.stats;
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
      <motion.div variants={fadeUp}>
        <h1 className="text-display-md tracking-normal">Overview</h1>
        <p className="mt-1 text-sm text-ink-muted">Your progress at a glance — assignment, roadmap, and what&apos;s next.</p>
      </motion.div>

      <motion.div variants={fadeUp}><AssignmentBanner /></motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <motion.div variants={fadeUp}><StatCard inverse value={String(daysSince(stats?.joinedAt))} label="Days on Mentra" /></motion.div>
        <motion.div variants={fadeUp}><StatCard value={assignmentValue} label="Assignment" /></motion.div>
        <motion.div variants={fadeUp}><StatCard value={roadmap?.hasRoadmap ? `${roadmap.percentComplete}%` : '—'} label="Roadmap done" /></motion.div>
        <motion.div variants={fadeUp}><StatCard value={roadmap?.hasRoadmap ? `Week ${roadmap.currentWeek}` : '—'} label="Current week" /></motion.div>
      </div>

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

    </motion.div>
    </motion.div>

    {!warping && (
      <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center">
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

function daysSince(value?: string) {
  if (!value) return 0;
  const diff = Date.now() - new Date(value).getTime();
  return Math.max(1, Math.ceil(diff / 86_400_000));
}
