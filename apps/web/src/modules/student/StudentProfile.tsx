import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  Check,
  Flame,
  Github,
  Globe,
  Linkedin,
  MapPin,
  Route as RouteIcon,
  Sparkles,
  Twitter,
  UserPlus,
  Wrench,
} from 'lucide-react';
import { Avatar, Badge, Card, ProfileHero, StatCard } from '@mentra/ui';
import type { CommunityPostView, PublicProfileView } from '@mentra/shared';
import { getStoredUser, resolveAvatarUrl } from '../../lib/auth.js';
import { usePublicProfile, useToggleFollow } from '../../lib/profile.js';
import { usePublicActivitySummary } from '../../lib/activity.js';
import { formatAgo, useAuthorPosts } from '../../lib/community.js';
import { renderRichText } from '../../components/RichComposer.js';
import { ActivityHeatmap } from '../../components/ActivityHeatmap.js';

/**
 * Public student profile — a social "career identity" card visible to other
 * students: portrait hero, headline, location, an achievement stat shelf (computed
 * from real activity), skills, and links.
 */

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

const GOAL_LABELS: Record<string, string> = {
  first_job: 'Landing their first job',
  switch_company: 'Switching company',
  fang_prep: 'FAANG / big-tech prep',
  startup_join: 'Joining a startup',
  freelance: 'Going freelance',
  upskill: 'Upskilling',
};

const EXPERIENCE_LABELS: Record<string, string> = {
  none: 'New to the field',
  intern: 'Internship experience',
  under_one: '< 1 year experience',
  one_to_three: '1–3 years experience',
  three_to_five: '3–5 years experience',
  five_plus: '5+ years experience',
};

export function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = usePublicProfile(id);

  const isSelf = getStoredUser()?.id === id;

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
        <Card className="text-sm text-ink-muted">Loading profile…</Card>
      ) : isError || !data ? (
        <Card className="text-sm text-ink-muted">This profile isn’t available.</Card>
      ) : (
        <ProfileBody profile={data} isSelf={isSelf} />
      )}
    </motion.div>
  );
}

/**
 * The public profile rendered inline (no back button / page chrome) — reused by the
 * Settings "Profile" tab so students see their own public profile directly.
 */
export function PublicProfileInline({ userId }: { userId: string | undefined }) {
  const { data, isLoading, isError } = usePublicProfile(userId);
  const isSelf = getStoredUser()?.id === userId;

  if (isLoading) return <Card className="text-sm text-ink-muted">Loading profile…</Card>;
  if (isError || !data) return <Card className="text-sm text-ink-muted">This profile isn’t available.</Card>;
  return <ProfileBody profile={data} isSelf={isSelf} />;
}

function ProfileBody({ profile, isSelf }: { profile: PublicProfileView; isSelf: boolean }) {
  const headline = useMemo(() => {
    if (profile.currentRole && profile.currentCompany) return `${profile.currentRole} · ${profile.currentCompany}`;
    if (profile.currentRole) return profile.currentRole;
    if (profile.goal) return GOAL_LABELS[profile.goal] ?? undefined;
    return undefined;
  }, [profile.currentRole, profile.currentCompany, profile.goal]);

  const location = [profile.city, profile.country].filter(Boolean).join(', ');
  const experience = profile.experienceLevel ? EXPERIENCE_LABELS[profile.experienceLevel] : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      {/* Left: portrait hero */}
      <motion.div variants={fadeUp} className="lg:sticky lg:top-0 lg:h-fit">
        <ProfileHero
          name={profile.name}
          role={headline}
          avatarUrl={resolveAvatarUrl(profile.avatarUrl)}
          experience={experience}
        />

        {/* Follower / following counts */}
        <div className="mt-3 flex items-center gap-5 px-1 text-sm">
          <span><b className="text-ink">{profile.followers}</b> <span className="text-ink-muted">followers</span></span>
          <span><b className="text-ink">{profile.following}</b> <span className="text-ink-muted">following</span></span>
        </div>

        {isSelf ? (
          <Link
            to="/settings?tab=settings"
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-surface-sunken text-sm font-semibold text-ink ring-1 ring-border-subtle transition hover:ring-border-strong"
          >
            Edit my profile
          </Link>
        ) : (
          <FollowButton profile={profile} />
        )}
      </motion.div>

      {/* Right: details */}
      <div className="min-w-0 space-y-6">
        {/* Meta row */}
        {(location || experience) ? (
          <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
            {location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4 text-ink-faint" /> {location}
              </span>
            ) : null}
            {experience ? (
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="size-4 text-ink-faint" /> {experience}
              </span>
            ) : null}
          </motion.div>
        ) : null}

        {/* Bio */}
        {profile.bio ? (
          <motion.div variants={fadeUp}>
            <Card>
              <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{profile.bio}</p>
            </Card>
          </motion.div>
        ) : null}

        {/* Achievement stat shelf — computed from real activity */}
        <motion.div variants={fadeUp}>
          <h2 className="mb-3 text-sm font-semibold text-ink">Achievements</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              value={profile.stats.roadmapCompletion ?? '—'}
              unit={profile.stats.roadmapCompletion == null ? undefined : '%'}
              label="Roadmap done"
            />
            <StatCard value={profile.stats.skillCount} label="Skills" />
            <StatCard value={profile.stats.communityPosts} label="Posts shared" />
            <StatCard value={memberSinceLabel(profile.stats.memberSince)} label="Member since" />
          </div>
        </motion.div>

        {/* Curated activity — streak, heatmap, recent milestones (public-safe) */}
        <motion.div variants={fadeUp}>
          <ActivitySummarySection userId={profile.userId} isSelf={isSelf} />
        </motion.div>

        {/* Skills */}
        {profile.techStack.length > 0 ? (
          <motion.div variants={fadeUp}>
            <Card>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                <Wrench className="size-4 text-ink-faint" /> Tech stack
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {profile.techStack.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-muted ring-1 ring-border-subtle"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Card>
          </motion.div>
        ) : null}

        {/* Goals / target roles */}
        {(profile.goal || profile.targetRoles.length > 0) ? (
          <motion.div variants={fadeUp}>
            <Card>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                <RouteIcon className="size-4 text-ink-faint" /> Career goal
              </h2>
              {profile.goal ? (
                <p className="text-sm text-ink">{GOAL_LABELS[profile.goal] ?? profile.goal}</p>
              ) : null}
              {profile.targetRoles.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {profile.targetRoles.map((r) => (
                    <Badge key={r} variant="outline" size="sm">
                      {r}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </Card>
          </motion.div>
        ) : null}

        {/* Links */}
        {(profile.githubUrl || profile.linkedinUrl || profile.portfolioUrl || profile.twitterUrl) ? (
          <motion.div variants={fadeUp}>
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-ink">Links</h2>
              <div className="flex flex-wrap gap-2">
                <LinkChip url={profile.githubUrl} icon={<Github className="size-4" />} label="GitHub" />
                <LinkChip url={profile.linkedinUrl} icon={<Linkedin className="size-4" />} label="LinkedIn" />
                <LinkChip url={profile.portfolioUrl} icon={<Globe className="size-4" />} label="Portfolio" />
                <LinkChip url={profile.twitterUrl} icon={<Twitter className="size-4" />} label="Twitter / X" />
              </div>
            </Card>
          </motion.div>
        ) : null}

        {/* Activity — their community posts */}
        <motion.div variants={fadeUp}>
          <h2 className="mb-3 text-sm font-semibold text-ink">Activity</h2>
          <ActivityFeed userId={profile.userId} name={profile.name} />
        </motion.div>
      </div>
    </div>
  );
}

function ActivitySummarySection({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const { data, isLoading } = usePublicActivitySummary(userId);

  if (isLoading || !data) return null;
  const hasActivity = data.activeDays.length > 0 || data.milestones.length > 0;
  if (!hasActivity) return null;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Activity</h2>
        <div className="flex items-center gap-2">
          {data.currentStreak > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink ring-1 ring-border-subtle">
              <Flame className="size-3.5 text-accent-amber" /> {data.currentStreak}-day streak
            </span>
          ) : null}
          {isSelf ? (
            <Link
              to="/analytics"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-surface-sunken px-3 text-xs font-semibold text-ink ring-1 ring-border-subtle transition hover:ring-border-strong"
            >
              <BarChart3 className="size-3.5" /> View analytics
            </Link>
          ) : null}
        </div>
      </div>

      <ActivityHeatmap activeDays={data.activeDays} />

      {data.milestones.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-border-subtle pt-4">
          {data.milestones.map((m, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-ink">{m.title}</span>
              <span className="shrink-0 text-xs text-ink-faint">{formatAgo(m.occurredAt)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function FollowButton({ profile }: { profile: PublicProfileView }) {
  const toggle = useToggleFollow(profile.userId);
  const following = profile.isFollowedByViewer;

  return (
    <button
      type="button"
      onClick={() => toggle.mutate(!following)}
      disabled={toggle.isPending}
      className={[
        'mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold transition disabled:opacity-50',
        following
          ? 'bg-surface-sunken text-ink ring-1 ring-border-subtle hover:ring-border-strong'
          : 'bg-surface-inverse text-ink-inverse hover:bg-ink',
      ].join(' ')}
    >
      {following ? <Check className="size-4" /> : <UserPlus className="size-4" />}
      {following ? 'Following' : 'Follow'}
    </button>
  );
}

function ActivityFeed({ userId, name }: { userId: string; name: string }) {
  const { data, isLoading } = useAuthorPosts(userId);

  if (isLoading) return <Card className="text-sm text-ink-muted">Loading activity…</Card>;
  const posts = data ?? [];
  if (posts.length === 0) {
    return <Card className="text-sm text-ink-muted">{name.split(' ')[0]} hasn’t posted anything yet.</Card>;
  }

  return (
    <div className="space-y-4">
      {posts.map((p) => (
        <ActivityPost key={p.id} post={p} />
      ))}
    </div>
  );
}

function ActivityPost({ post: p }: { post: CommunityPostView }) {
  return (
    <Card padding={false} className="p-4">
      <div className="flex items-center gap-3">
        <Avatar src={resolveAvatarUrl(p.author.avatarUrl)} name={p.author.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">{p.author.name}</div>
          <div className="text-xs text-ink-faint">
            {formatAgo(p.createdAt)}
            {p.editedAt ? ' · edited' : ''}
          </div>
        </div>
      </div>
      {p.body ? (
        <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink">{renderRichText(p.body)}</div>
      ) : null}
      {p.mediaUrl ? (
        <img src={p.mediaUrl} alt="post media" loading="lazy" decoding="async" className="mt-3 max-h-96 rounded-md ring-1 ring-border-subtle" />
      ) : null}
    </Card>
  );
}

function LinkChip({ url, icon, label }: { url: string | null; icon: React.ReactNode; label: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-md bg-surface-sunken px-3 py-2 text-xs font-medium text-ink ring-1 ring-border-subtle transition hover:ring-border-strong"
    >
      {icon}
      {label}
    </a>
  );
}

/** "Jul 2026" from an ISO date — compact, used inside a stat tile. */
function memberSinceLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}
