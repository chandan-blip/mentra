import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  BrainCircuit,
  CalendarClock,
  GraduationCap,
  MessagesSquare,
  Radio,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { Avatar, Badge, Card } from '@mentra/ui';
import type { MentorDetailView } from '@mentra/shared';
import { resolveAvatarUrl } from '../../lib/auth.js';
import { StarRating } from '../../components/StarRating.js';
import { ProgressRing } from '../../components/ProgressRing.js';
import { avatarBg, formatPrice, hueOf, useMentorDetail } from '../../lib/mentors.js';
import { CheckoutModal } from '../student/Mentors.js';

/**
 * Mentor details — a graphical, at-a-glance profile of a single mentor: their impact
 * (sessions run, students helped, doubts fielded), their ratings, and the breadth of
 * their knowledge, all rendered with the app's inline-SVG marks (no chart library).
 */

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

// Accent hexes for the SVG rings (kept in sync with the theme's accent tokens).
const ACCENT = { blue: '#3b82f6', green: '#22c55e', amber: '#f59e0b', violet: '#8b5cf6' };
const RING_TRACK = 'rgba(148,163,184,0.22)';

export function MentorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useMentorDetail(id);
  const [checkout, setCheckout] = useState(false);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto w-full max-w-8xl"
    >
      <motion.button
        variants={fadeUp}
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Back
      </motion.button>

      {isLoading ? (
        <Card className="text-sm text-ink-muted">Loading mentor…</Card>
      ) : isError || !data ? (
        <Card className="text-sm text-ink-muted">This mentor isn’t available.</Card>
      ) : (
        <>
          <MentorBody mentor={data} onBook={() => setCheckout(true)} />
          {checkout ? (
            <CheckoutModal
              mentor={{ userId: data.userId, name: data.name, sessionPriceCents: data.sessionPriceCents }}
              onClose={() => setCheckout(false)}
              onDone={() => navigate('/mentors')}
            />
          ) : null}
        </>
      )}
    </motion.div>
  );
}

function MentorBody({ mentor, onBook }: { mentor: MentorDetailView; onBook: () => void }) {
  const s = mentor.stats;
  const hue = hueOf(mentor.userId);
  // A single 0–100 "knowledge breadth" proxy from listed expertise, stack, and tenure.
  const knowledge = Math.min(
    100,
    s.expertiseCount * 9 + s.techStackCount * 4 + (s.yearsExperience ?? 0) * 4,
  );

  return (
    <div className="space-y-6">
      {/* Hero */}
      <motion.div variants={fadeUp}>
        <Card className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span
            className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl text-2xl font-semibold text-white"
            style={{ background: avatarBg(hue) }}
          >
            {mentor.avatarUrl ? (
              <Avatar src={resolveAvatarUrl(mentor.avatarUrl)} name={mentor.name} size="lg" />
            ) : (
              initials(mentor.name)
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-display-sm tracking-normal text-ink">{mentor.name}</h1>
              {mentor.accepting ? (
                <Badge variant="success" size="sm">
                  <BadgeCheck className="size-3" /> Accepting
                </Badge>
              ) : (
                <Badge variant="outline" size="sm">
                  Not accepting
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-ink-muted">{mentor.headline ?? 'Mentor'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
              {mentor.yearsExperience != null ? (
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap className="size-3.5" /> {mentor.yearsExperience} yr experience
                </span>
              ) : null}
              {s.avgRating != null ? (
                <span className="inline-flex items-center gap-1.5">
                  <Star className="size-3.5 fill-accent-amber text-accent-amber" /> {s.avgRating.toFixed(1)} ·{' '}
                  {s.ratingCount} rating{s.ratingCount === 1 ? '' : 's'}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-3.5" /> {mentor.openSlotCount} open slot
                {mentor.openSlotCount === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <div className="text-right text-sm font-semibold text-ink">
              {formatPrice(mentor.sessionPriceCents)}
              <span className="text-xs font-normal text-ink-faint">/session</span>
            </div>
            <button
              type="button"
              onClick={onBook}
              disabled={mentor.openSlotCount === 0}
              className="flex h-10 items-center justify-center gap-1.5 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
              title={mentor.openSlotCount === 0 ? 'No open slots' : undefined}
            >
              <CalendarClock className="size-4" /> {mentor.openSlotCount > 0 ? 'Book a session' : 'No open slots'}
            </button>
          </div>
        </Card>
      </motion.div>

      {mentor.bio ? (
        <motion.div variants={fadeUp}>
          <Card>
            <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{mentor.bio}</p>
          </Card>
        </motion.div>
      ) : null}

      {/* Impact shelf */}
      <motion.div variants={fadeUp}>
        <h2 className="mb-3 text-sm font-semibold text-ink">Impact at a glance</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile icon={<GraduationCap className="size-4" />} value={s.sessionsConducted} label="Sessions conducted" color={ACCENT.green} />
          <MetricTile icon={<Users className="size-4" />} value={s.studentsHelped} label="Students helped" color={ACCENT.blue} />
          <MetricTile icon={<MessagesSquare className="size-4" />} value={s.doubtsAsked} label="Doubts answered" color={ACCENT.violet} />
          <MetricTile icon={<Radio className="size-4" />} value={s.liveSessions} label="Live sessions" color={ACCENT.amber} />
        </div>
      </motion.div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Knowledge breadth */}
        <motion.div variants={fadeUp}>
          <Card className="flex h-full flex-col">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
              <BrainCircuit className="size-4 text-ink-faint" /> Knowledge breadth
            </h2>
            <p className="mb-4 text-xs leading-5 text-ink-faint">
              A proxy from listed expertise, stack, and tenure.
            </p>
            <div className="flex items-center gap-5">
              <ProgressRing value={knowledge} color={ACCENT.violet} trackColor={RING_TRACK} size={104} stroke={10}>
                <div>
                  <div className="text-display-sm leading-none text-ink">{Math.round(knowledge)}</div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-faint">/ 100</div>
                </div>
              </ProgressRing>
              <div className="min-w-0 flex-1 space-y-2 text-sm">
                <KnowledgeStat label="Areas of expertise" value={s.expertiseCount} />
                <KnowledgeStat label="Technologies" value={s.techStackCount} />
                <KnowledgeStat label="Years of experience" value={s.yearsExperience ?? '—'} />
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Ratings */}
        <motion.div variants={fadeUp}>
          <Card className="flex h-full flex-col">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <Award className="size-4 text-ink-faint" /> Student ratings
            </h2>
            {s.ratingCount === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
                <Star className="size-8 text-ink-faint" />
                <p className="text-sm text-ink-muted">No ratings yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-display-md leading-none text-ink">{(s.avgRating ?? 0).toFixed(1)}</div>
                    <div className="mt-1.5">
                      <StarRating score={Math.round(s.avgRating ?? 0)} size="sm" />
                    </div>
                    <div className="mt-1 text-xs text-ink-faint">
                      {s.ratingCount} rating{s.ratingCount === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {[5, 4, 3, 2, 1].map((star) => (
                      <RatingBar
                        key={star}
                        star={star}
                        count={s.ratingDistribution[star - 1] ?? 0}
                        total={s.ratingCount}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Mentorship activity */}
        <motion.div variants={fadeUp}>
          <Card className="flex h-full flex-col">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <Sparkles className="size-4 text-ink-faint" /> Mentorship activity
            </h2>
            <div className="space-y-3">
              <ActivityBar label="Completed sessions" value={s.sessionsConducted} max={s.totalBookings} color={ACCENT.green} />
              <ActivityBar label="Upcoming sessions" value={s.upcomingSessions} max={s.totalBookings} color={ACCENT.blue} />
              <ActivityBar label="Total bookings" value={s.totalBookings} max={s.totalBookings} color={ACCENT.violet} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border-subtle pt-4">
              <MiniStat label="Doubt threads" value={s.doubtThreads} />
              <MiniStat label="Questions asked" value={s.doubtsAsked} />
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Knowledge chips */}
      {mentor.expertise.length > 0 || mentor.techStack.length > 0 ? (
        <motion.div variants={fadeUp}>
          <Card className="space-y-4">
            {mentor.expertise.length > 0 ? (
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                  <Award className="size-4 text-ink-faint" /> Areas of expertise
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {mentor.expertise.map((e) => (
                    <span
                      key={e}
                      className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-muted ring-1 ring-border-subtle"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {mentor.techStack.length > 0 ? (
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                  <BrainCircuit className="size-4 text-ink-faint" /> Tech stack
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {mentor.techStack.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-muted ring-1 ring-border-subtle"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        </motion.div>
      ) : null}
    </div>
  );
}

// --- Marks ---

function MetricTile({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <span
        className="grid size-9 place-items-center rounded-lg"
        style={{ background: `${color}1f`, color }}
      >
        {icon}
      </span>
      <div>
        <div className="text-display-md leading-none text-ink">{value}</div>
        <div className="mt-1.5 text-sm text-ink-muted">{label}</div>
      </div>
    </Card>
  );
}

function KnowledgeStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span className="font-semibold tabular-nums text-ink">{value}</span>
    </div>
  );
}

function RatingBar({ star, count, total }: { star: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex w-6 shrink-0 items-center gap-0.5 tabular-nums text-ink-faint">
        {star}
        <Star className="size-3 fill-ink-faint text-ink-faint" />
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
        <motion.div
          className="h-full rounded-full bg-accent-amber"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22 }}
        />
      </div>
      <span className="w-5 shrink-0 text-right tabular-nums text-ink-faint">{count}</span>
    </div>
  );
}

function ActivityBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-ink-muted">{label}</span>
        <span className="font-semibold tabular-nums text-ink">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22 }}
        />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-surface-sunken px-3 py-2 ring-1 ring-border-subtle">
      <div className="text-lg font-semibold leading-none text-ink">{value}</div>
      <div className="mt-1 text-xs text-ink-faint">{label}</div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
