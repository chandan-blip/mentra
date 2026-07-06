import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Search, UserPlus, Users } from 'lucide-react';
import { Avatar, Card } from '@mentra/ui';
import type { PublicProfileCardView } from '@mentra/shared';
import { resolveAvatarUrl } from '../../lib/auth.js';
import { PageHeader } from '../../components/PageHeader.js';
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
      className="mx-auto w-full max-w-8xl"
    >
      <motion.div variants={fadeUp}>
        <PageHeader
          icon={<Users />}
          title="Students"
          subtitle="Discover people on the platform — follow, learn, and share."
        />
      </motion.div>

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

  return (
    <Card className="flex flex-col gap-3 p-4">
      <Link to={`/students/${s.userId}`} className="flex items-start gap-3">
        <Avatar src={resolveAvatarUrl(s.avatarUrl)} name={s.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">{s.name}</div>
          {s.headline ? <div className="truncate text-xs text-ink-faint">{s.headline}</div> : null}
          {s.location ? <div className="mt-0.5 truncate text-[11px] text-ink-faint">{s.location}</div> : null}
        </div>
      </Link>

      {s.techStack.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {s.techStack.map((t) => (
            <span key={t} className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-muted ring-1 ring-border-subtle">
              {t}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-xs text-ink-faint">
          {s.followers} follower{s.followers === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={() => toggle.mutate(!following)}
          disabled={toggle.isPending}
          className={[
            'flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold transition disabled:opacity-50',
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
