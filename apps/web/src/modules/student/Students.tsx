import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Github, Globe, Linkedin, MapPin, Search, Twitter, UserPlus, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar, Card } from '@mentra/ui';
import type { PublicProfileCardView } from '@mentra/shared';
import { resolveAvatarUrl } from '../../lib/auth.js';
import { useDirectory, useToggleFollow } from '../../lib/profile.js';

/**
 * Students — the discovery directory. Browse and search everyone on the platform,
 * open a profile, or follow directly from a card.
 */

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

export function StudentsPage() {
  const [q, setQ] = useState('');
  const { data, isLoading, isError } = useDirectory(q);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04 } } }}
      className="mx-auto w-full sm:space-y-6 max-w-8xl"
    >
      <motion.div variants={fadeUp} className="relative mb-5">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, skill, or role…"
          className="auth-input-plain h-11 w-full pl-9"
        />
      </motion.div>

      {isLoading ? (
        <Card className="text-sm text-ink-muted">Loading students…</Card>
      ) : isError ? (
        <Card className="text-sm text-ink-muted">Couldn’t load the directory. Try again shortly.</Card>
      ) : (data?.length ?? 0) === 0 ? (
        <Card className="text-sm text-ink-muted">
          {q.trim() ? 'No students match your search.' : 'No students to show yet.'}
        </Card>
      ) : (
        <motion.div variants={fadeUp} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data!.map((s) => (
            <StudentCard key={s.userId} student={s} />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

function StudentCard({ student: s }: { student: PublicProfileCardView }) {
  const toggle = useToggleFollow(s.userId);
  const following = s.isFollowedByViewer;

  const shownStack = s.techStack.slice(0, 4);
  const extraStack = s.techStack.length - shownStack.length;
  const hasLinks = Boolean(s.githubUrl || s.linkedinUrl || s.portfolioUrl || s.twitterUrl);

  return (
    <Card padding={false} className="group flex flex-col overflow-hidden">
      {/* Textured banner (monochrome dot-grid, on-theme) that the avatar punches out of. */}
      <div className="relative h-14 bg-surface-raised">
        <div className="absolute inset-0 bg-dot-grid opacity-70 [background-size:16px_16px]" />
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-b from-transparent to-surface" />
      </div>

      {/* Identity — avatar overlapping the banner, name, headline. */}
      <div className="flex flex-col items-center px-4 text-center">
        <Link to={`/students/${s.userId}`} aria-label={s.name} className="-mt-8">
          <span className="block rounded-full ring-4 ring-surface transition group-hover:ring-border-strong">
            <Avatar src={resolveAvatarUrl(s.avatarUrl)} name={s.name} size="xl" />
          </span>
        </Link>
        <Link to={`/students/${s.userId}`} className="mt-2 block max-w-full">
          <div className="truncate text-sm font-semibold text-ink transition-colors group-hover:text-accent-blue">
            {s.name}
          </div>
          {s.headline ? <div className="mt-0.5 truncate text-xs text-ink-muted">{s.headline}</div> : null}
        </Link>

        {/* Stat pills */}
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
          {s.location ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-1 text-[11px] text-ink-muted ring-1 ring-border-subtle">
              <MapPin className="size-3" />
              <span className="max-w-[110px] truncate">{s.location}</span>
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-1 text-[11px] font-medium text-ink ring-1 ring-border-subtle">
            <Users className="size-3 text-ink-muted" />
            {s.followers}
            <span className="font-normal text-ink-faint">follower{s.followers === 1 ? '' : 's'}</span>
          </span>
        </div>
      </div>

      {/* Tech stack */}
      {shownStack.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 px-4">
          {shownStack.map((t) => (
            <span key={t} className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-muted ring-1 ring-border-subtle">
              {t}
            </span>
          ))}
          {extraStack > 0 ? <span className="text-[11px] text-ink-faint">+{extraStack}</span> : null}
        </div>
      ) : null}

      {/* Social + follow */}
      <div className="mt-auto flex flex-col gap-3 p-4 pt-3">
        {hasLinks ? (
          <div className="flex justify-center">
            <SocialLinks student={s} />
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => toggle.mutate(!following)}
          disabled={toggle.isPending}
          className={[
            'inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition disabled:opacity-50',
            following
              ? 'bg-surface-sunken text-ink ring-1 ring-border-subtle hover:ring-border-strong'
              : 'bg-surface-inverse text-ink-inverse hover:bg-ink',
          ].join(' ')}
        >
          {following ? <Check className="size-3.5" /> : <UserPlus className="size-3.5" />}
          {following ? 'Following' : 'Follow'}
        </button>
      </div>
    </Card>
  );
}

/**
 * Clickable social-link icons for a directory card. Renders only the icons whose URL is
 * present, and nothing at all when the student has shared no links. Kept outside the card's
 * profile <Link> so a click opens the external site rather than navigating to the profile.
 */
function SocialLinks({ student: s }: { student: PublicProfileCardView }) {
  const links: { url: string | null; icon: ReactNode; label: string }[] = [
    { url: s.githubUrl, icon: <Github className="size-3.5" />, label: 'GitHub' },
    { url: s.linkedinUrl, icon: <Linkedin className="size-3.5" />, label: 'LinkedIn' },
    { url: s.portfolioUrl, icon: <Globe className="size-3.5" />, label: 'Portfolio' },
    { url: s.twitterUrl, icon: <Twitter className="size-3.5" />, label: 'Twitter / X' },
  ];
  const shown = links.filter((l) => Boolean(l.url));

  if (shown.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((l) => (
        <a
          key={l.label}
          href={l.url ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${s.name} on ${l.label}`}
          title={l.label}
          className="grid size-7 place-items-center rounded-md text-ink-faint transition hover:bg-surface-sunken hover:text-ink"
        >
          {l.icon}
        </a>
      ))}
    </div>
  );
}
