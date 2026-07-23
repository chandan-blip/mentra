import type { ComponentType } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Briefcase,
  CalendarClock,
  Clock,
  Code2,
  Flame,
  FolderGit2,
  GraduationCap,
  PlayCircle,
  Radio,
  Sparkles,
  Target,
  Users,
  Video,
} from 'lucide-react';
import { Badge, Card } from '@mentra/ui';
import type { LiveSessionView, MentorMatchView } from '@mentra/shared';
import { getStoredUser, resolveAvatarUrl } from '../../lib/auth.js';
import { useDashboardOverview } from '../../lib/dashboard.js';
import { useProfile } from '../../lib/profile.js';
import { useActivityFocus, useActivitySummary } from '../../lib/activity.js';
import { useLiveSessions, useUpcomingOpen } from '../../lib/live.js';
import { useLearningProgress } from '../../lib/learning.js';
import { useCodingProgress } from '../../lib/coding.js';
import { formatPrice, formatSlot, useMentorMatches } from '../../lib/mentors.js';
import { ActivityHeatmap } from '../../components/ActivityHeatmap.js';

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
};

/** A single, motivating one-liner tuned to the student's stated goal. */
const GOAL_LINE: Record<string, string> = {
  first_job: 'Your first offer is the goal — every session and rep moves you closer.',
  switch_company: 'Ready for a better role. Let’s get you interview-sharp.',
  fang_prep: 'Big-tech ready. Drill the rounds until they’re second nature.',
  startup_join: 'Startup-bound. Build the range they actually hire for.',
  freelance: 'Independent path. Sharpen the skills clients pay for.',
  upskill: 'Leveling up. Consistency compounds — show up today.',
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'U';
}

/**
 * Student home. Frames the whole journey — 1:1 mentorship + mock interviews, coding practice,
 * and learning tracks — around the one thing that matters to the student: getting placed.
 */
export function StudentDashboard() {
  const { data: overview } = useDashboardOverview();
  const { data: profileMe } = useProfile();
  const { data: summary } = useActivitySummary();
  const learning = useLearningProgress().data;
  const coding = useCodingProgress().data;

  const name = overview?.profile.name ?? getStoredUser()?.name ?? 'there';
  const firstName = name.split(' ')[0];
  const streak = summary?.currentStreak ?? 0;
  const goal = profileMe?.profile.goal ?? null;
  const missionLine = (goal && GOAL_LINE[goal]) || 'Interview-ready, one focused session at a time.';
  const profileIncomplete = (overview?.nextSteps ?? []).some((r) => r.recId === 'finish-profile');

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } }}
      className="mx-auto w-full max-w-8xl space-y-6 pt-4 md:pt-0"
    >
      {/* Hero */}
      <motion.section variants={fadeUp}>
        <div
          className="relative overflow-hidden rounded-lg p-6 text-ink-inverse ring-1 ring-white/10 sm:p-8"
          style={{ background: 'radial-gradient(130% 160% at 100% 0%, #1e293b 0%, #0f172a 55%)' }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '18px 18px' }}
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              {streak > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/15">
                  <Flame className="size-3.5 text-accent-amber" /> {streak}-day streak
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/15">
                  <Target className="size-3.5 text-accent-blue" /> Placement track
                </span>
              )}
              <h1 className="mt-3 text-display-md tracking-normal">
                {greeting()}, {firstName}
              </h1>
              <p className="mt-2 text-sm leading-6 text-white/70">{missionLine}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {profileIncomplete ? (
                  <HeroButton to="/settings?tab=settings" primary>
                    Complete your profile
                  </HeroButton>
                ) : null}
                <HeroButton to="/live-sessions" primary={!profileIncomplete}>
                  Browse live sessions
                </HeroButton>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 lg:gap-4">
              <HeroStat value={streak} label="Day streak" />
              <HeroStat value={coding?.solved ?? 0} label="Problems solved" />
              <HeroStat value={learning?.testsPassed ?? 0} label="Tests passed" />
            </div>
          </div>
        </div>
      </motion.section>

      {/* Sessions + focus */}
      <div className="grid grid-cols-12 gap-6">
        <motion.div variants={fadeUp} className="col-span-12 lg:col-span-8">
          <SessionsCard />
        </motion.div>
        <motion.div variants={fadeUp} className="col-span-12 lg:col-span-4">
          <FocusCard />
        </motion.div>
      </div>

      {/* Three pillars */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <motion.div variants={fadeUp}>
          <Pillar
            to="/mentors"
            icon={Users}
            tint="blue"
            title="Mentorship & mock interviews"
            desc="Get paired with working engineers for every round — DSA, system design, HR."
            stat="Book a 1:1"
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <Pillar
            to="/coding"
            icon={Code2}
            tint="green"
            title="Coding practice"
            desc="Sharpen DSA and problem-solving in the in-app editor, graded instantly."
            stat={coding ? `${coding.solved}/${coding.totalQuestions} solved` : 'Start solving'}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <Pillar
            to="/learning"
            icon={BookOpen}
            tint="amber"
            title="Learning tracks"
            desc="AI test-series tuned to your target roles — beginner to advanced."
            stat={learning ? `${learning.testsPassed} tests passed` : 'Explore tracks'}
          />
        </motion.div>
      </div>

      {/* Consistency + mentors */}
      <div className="grid grid-cols-12 gap-6">
        <motion.div variants={fadeUp} className="col-span-12 lg:col-span-7">
          <ConsistencyCard />
        </motion.div>
        <motion.div variants={fadeUp} className="col-span-12 lg:col-span-5">
          <MentorsCard />
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero atoms                                                         */
/* ------------------------------------------------------------------ */

function HeroButton({ to, children, primary }: { to: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={
        primary
          ? 'inline-flex h-10 items-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-ink transition hover:bg-white/90'
          : 'inline-flex h-10 items-center gap-2 rounded-md bg-white/10 px-5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15'
      }
    >
      {children}
      <ArrowRight className="size-4" />
    </Link>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-md bg-white/5 px-4 py-3 text-center ring-1 ring-white/10">
      <div className="text-display-sm leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] text-white/60">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live & upcoming sessions                                           */
/* ------------------------------------------------------------------ */

function SessionsCard() {
  const live = useLiveSessions().data ?? [];
  const upcoming = useUpcomingOpen().data ?? [];
  const rows = [...live, ...upcoming.filter((u) => !live.some((l) => l.id === u.id))].slice(0, 4);

  return (
    <Card className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Radio className="size-4 text-accent-blue" /> Live &amp; upcoming sessions
        </h3>
        <Link to="/live-sessions" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-ink">
          See all <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md bg-surface-sunken py-10 text-center ring-1 ring-border-subtle">
          <CalendarClock className="size-6 text-ink-faint" />
          <p className="text-sm text-ink-muted">No sessions scheduled right now.</p>
          <Link to="/live-sessions" className="text-xs font-semibold text-accent-blue hover:underline">
            Browse the sessions library →
          </Link>
        </div>
      ) : (
        <div className="-mx-1 space-y-1.5">
          {rows.map((s) => (
            <SessionRow key={s.id} session={s} isLive={s.status === 'live'} />
          ))}
        </div>
      )}
    </Card>
  );
}

function SessionRow({ session: s, isLive }: { session: LiveSessionView; isLive: boolean }) {
  return (
    <Link
      to={`/live-sessions/${s.id}`}
      className="flex items-center gap-3 rounded-md px-3 py-2.5 ring-1 ring-transparent transition hover:bg-surface-sunken hover:ring-border-subtle"
    >
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-md ${
          isLive ? 'bg-accent-red/10 text-accent-red' : 'bg-surface-sunken text-ink-muted ring-1 ring-border-subtle'
        }`}
      >
        {isLive ? <span className="size-2.5 animate-pulse rounded-full bg-accent-red" /> : <Video className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{s.title}</div>
        <div className="truncate text-xs text-ink-faint">
          {s.mentorName} · {isLive ? 'Live now' : formatSlot(s.scheduledFor ?? s.startedAt ?? s.createdAt)}
        </div>
      </div>
      {isLive ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent-red px-3 py-1.5 text-xs font-semibold text-white">
          <PlayCircle className="size-3.5" /> Join
        </span>
      ) : (
        <ArrowUpRight className="size-4 shrink-0 text-ink-faint" />
      )}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Where to focus (AI)                                                */
/* ------------------------------------------------------------------ */

function focusIcon(href: string | null): ComponentType<{ className?: string }> {
  if (!href) return Sparkles;
  if (href.startsWith('/learning')) return GraduationCap;
  if (href.startsWith('/coding')) return Code2;
  if (href.startsWith('/projects')) return FolderGit2;
  if (href.startsWith('/jobs')) return Briefcase;
  if (href.startsWith('/live-sessions') || href.startsWith('/mentor')) return Video;
  return Target;
}

function FocusCard() {
  const { data, isLoading } = useActivityFocus();

  return (
    <Card className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="grid size-7 place-items-center rounded-md bg-accent-blue/10 text-accent-blue">
            <Target className="size-4" />
          </span>
          Where to focus
        </h3>
        {data ? <Badge variant="outline" size="md">{data.source === 'ai' ? 'AI' : 'For you'}</Badge> : null}
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-muted">Analyzing your progress…</p>
      ) : !data || data.items.length === 0 ? (
        <p className="text-sm leading-6 text-ink-muted">Do a bit more — a coding rep or a test — and personalized guidance appears here.</p>
      ) : (
        <>
          <p className="mb-3 border-l-2 border-accent-blue/60 pl-3 text-sm font-semibold leading-6 text-ink">{data.headline}</p>
          <div className="space-y-2">
            {data.items.slice(0, 3).map((it, i) => {
              const Icon = focusIcon(it.href);
              const inner = (
                <>
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-inverse text-ink-inverse [&_svg]:size-4">
                    <Icon />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{it.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-ink-muted">{it.reason}</span>
                  </span>
                  {it.href ? <ArrowUpRight className="size-4 shrink-0 self-center text-ink-faint" /> : null}
                </>
              );
              return it.href ? (
                <Link key={i} to={it.href} className="flex items-center gap-3 rounded-lg bg-surface-sunken p-2.5 ring-1 ring-border-subtle transition hover:ring-border-strong">
                  {inner}
                </Link>
              ) : (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-surface-sunken p-2.5 ring-1 ring-border-subtle">
                  {inner}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Pillars                                                            */
/* ------------------------------------------------------------------ */

const TINT: Record<string, string> = {
  blue: 'bg-accent-blue/10 text-accent-blue',
  green: 'bg-accent-green/10 text-accent-green',
  amber: 'bg-accent-amber/10 text-accent-amber',
};

function Pillar({
  to,
  icon: Icon,
  tint,
  title,
  desc,
  stat,
}: {
  to: string;
  icon: ComponentType<{ className?: string }>;
  tint: keyof typeof TINT | string;
  title: string;
  desc: string;
  stat: string;
}) {
  return (
    <Link
      to={to}
      className="group flex h-full flex-col rounded-lg bg-surface p-5 ring-1 ring-border-subtle transition hover:shadow-card-hover hover:ring-border-strong"
    >
      <span className={`grid size-11 place-items-center rounded-lg ${TINT[tint] ?? TINT.blue} [&_svg]:size-5`}>
        <Icon />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-6 text-ink-muted">{desc}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs font-semibold text-ink">{stat}</span>
        <span className="grid size-7 place-items-center rounded-full bg-surface-sunken text-ink-muted ring-1 ring-border-subtle transition group-hover:bg-surface-inverse group-hover:text-ink-inverse">
          <ArrowRight className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Consistency                                                        */
/* ------------------------------------------------------------------ */

function ConsistencyCard() {
  const { data } = useActivitySummary();
  return (
    <Card className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Flame className="size-4 text-accent-amber" /> Your consistency
        </h3>
        <Link to="/analytics" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-ink">
          Analytics <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <ActivityHeatmap activeDays={data?.activeDays ?? []} />
      <div className="mt-4 grid grid-cols-3 gap-3">
        <MiniStat value={data?.currentStreak ?? 0} label="Day streak" />
        <MiniStat value={data?.weekCount ?? 0} label="This week" />
        <MiniStat value={data?.longestStreak ?? 0} label="Longest" />
      </div>
    </Card>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-md bg-surface-sunken px-3 py-2.5 ring-1 ring-border-subtle">
      <div className="text-display-sm leading-none tabular-nums text-ink">{value}</div>
      <div className="mt-1 text-xs text-ink-faint">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mentors for you                                                    */
/* ------------------------------------------------------------------ */

function MentorsCard() {
  const matches = useMentorMatches().data ?? [];
  const top = matches.slice(0, 2);

  return (
    <Card className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Users className="size-4 text-accent-blue" /> Mentors for you
        </h3>
        <Link to="/mentors" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition hover:text-ink">
          See all <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {top.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md bg-surface-sunken py-8 text-center ring-1 ring-border-subtle">
          <GraduationCap className="size-6 text-ink-faint" />
          <p className="text-sm text-ink-muted">Working professionals ready to prep you for every round.</p>
          <Link to="/mentors" className="text-xs font-semibold text-accent-blue hover:underline">
            Explore mentors →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {top.map((m) => (
            <MentorRow key={m.mentor.userId} match={m} />
          ))}
        </div>
      )}
    </Card>
  );
}

function MentorRow({ match: m }: { match: MentorMatchView }) {
  const mentor = m.mentor;
  return (
    <Link
      to="/mentors"
      className="flex items-center gap-3 rounded-lg bg-surface-sunken p-3 ring-1 ring-border-subtle transition hover:ring-border-strong"
    >
      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-surface text-sm font-semibold text-ink-muted ring-1 ring-border-subtle">
        {mentor.avatarUrl ? (
          <img src={resolveAvatarUrl(mentor.avatarUrl)} alt={mentor.name} className="h-full w-full object-cover" />
        ) : (
          initials(mentor.name)
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-ink">{mentor.name}</span>
          {mentor.openSlotCount > 0 ? <Badge variant="success" size="sm">Open</Badge> : null}
        </div>
        <div className="truncate text-xs text-ink-muted">{mentor.headline ?? (mentor.expertise.slice(0, 3).join(' · ') || 'Mentor')}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold text-ink">{formatPrice(mentor.sessionPriceCents)}</div>
        <div className="inline-flex items-center gap-0.5 text-[11px] font-medium text-accent-blue">
          Book <Clock className="size-3" />
        </div>
      </div>
    </Link>
  );
}
