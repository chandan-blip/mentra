import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.js';
import { MessageSquare, Play, Users, Video } from 'lucide-react';
import { Avatar } from '@mentra/ui';
import type { LiveSessionView } from '@mentra/shared';
import {
  formatDuration,
  hueOf,
  stageBg,
  useLiveSessions,
  usePastSessions,
  useUpcoming,
} from '../../lib/live.js';
import { resolveAvatarUrl } from '../../lib/auth.js';

/**
 * Student Live Sessions — watch mentors teach live (LiveKit SFU) and chat in real
 * time (Socket.IO). Mentors broadcast from the separate Mentor Live Sessions module.
 */

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

export function LiveSessionsPage() {
  const navigate = useNavigate();
  const live = useLiveSessions();
  const upcoming = useUpcoming();
  const past = usePastSessions();

  // One unified feed, ordered live → upcoming → past/recorded.
  const sessions = [...(live.data ?? []), ...(upcoming.data ?? []), ...(past.data ?? [])];
  const loading = live.isLoading || upcoming.isLoading || past.isLoading;

  // Every card opens the dedicated watch page, which renders the right experience for the
  // session's state (live stage / recording player / upcoming placeholder).
  const openSession = (s: LiveSessionView) => navigate(`/live-sessions/${s.id}`);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto w-full max-w-8xl"
    >
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-3">
        <PageHeader
          icon={<Video />}
          title="Sessions"
          subtitle="Watch mentors teach live and ask questions in real time."
        />
      </motion.div>

      <motion.div variants={fadeUp}>
        {loading && sessions.length === 0 ? (
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <PlaceholderVideoCard key={i} label="Loading…" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <EmptyVideoGrid label="No sessions yet" />
        ) : (
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sessions.map((s) => (
              <VideoCard key={s.id} session={s} onOpen={() => openSession(s)} />
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// --- Video card (YouTube-style) ---

/** Compact number (1.2K, 3M) for the views / comments counts. */
function compact(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/** Recording duration (startedAt→endedAt) as mm:ss / h:mm:ss, or null if unknown. */
function durationOf(startIso: string | null, endIso: string | null): string | null {
  if (!startIso || !endIso) return null;
  const secs = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000);
  return secs > 0 ? formatDuration(secs) : null;
}

/**
 * YouTube-style video card: a 16:9 thumbnail with a status/duration badge, then the
 * mentor avatar beside the title and a views·comments meta line. Clicking opens the live
 * stage (live) or the recording (ready); upcoming / still-processing cards are inert.
 */
export function VideoCard({ session: s, onOpen }: { session: LiveSessionView; onOpen: () => void }) {
  const isLive = s.status === 'live';
  const isUpcoming = s.status === 'scheduled';
  const ready = s.recordingStatus === 'ready' && Boolean(s.recordingUrl);
  const processing = s.recordingStatus === 'recording' || s.recordingStatus === 'processing';
  const poster = ready ? posterFor(s.recordingUrl) : undefined;
  // Prefer the exact transcoded duration; fall back to wall-clock for older rows.
  const duration = s.durationSeconds ? formatDuration(s.durationSeconds) : durationOf(s.startedAt, s.endedAt);
  const views = isLive ? s.currentViewers : s.peakViewers;

  return (
    <div className="flex flex-col gap-2.5 rounded-[22px] bg-[#101010] p-[5px]">
      <button
        type="button"
        onClick={onOpen}
        aria-label={isLive ? `Watch ${s.title} live` : ready ? `Play ${s.title}` : `Open ${s.title}`}
        className="group relative aspect-video w-full overflow-hidden rounded-lg ring-1 ring-border-subtle"
        style={{ background: stageBg(hueOf(s.id)) }}
      >
        {poster ? (
          <img src={poster} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-white/70">
            <Video className="size-8" />
          </span>
        )}

        {/* Status badge (top-left) */}
        {isLive ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-accent-red px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            <span className="size-1.5 animate-pulse rounded-full bg-white" /> Live
          </span>
        ) : isUpcoming ? (
          <span className="absolute left-2 top-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
            Upcoming
          </span>
        ) : processing ? (
          <span className="absolute left-2 top-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            Processing…
          </span>
        ) : null}

        {/* Duration (past) or live watcher count (bottom-right) */}
        {isLive ? (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white">
            <Users className="size-3" /> {compact(s.currentViewers)}
          </span>
        ) : duration ? (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
            {duration}
          </span>
        ) : null}

        {/* Scheduled time (bottom-left) for upcoming */}
        {isUpcoming && s.scheduledFor ? (
          <span className="absolute bottom-2 left-2 rounded bg-black/65 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            {formatWhen(s.scheduledFor)}
          </span>
        ) : null}

        {/* Hover play affordance for playable cards (live / ready recording) */}
        {isLive || ready ? (
          <span className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/15">
            <span className="grid size-12 scale-90 place-items-center rounded-full bg-white/90 text-ink opacity-0 shadow-lg transition group-hover:scale-100 group-hover:opacity-100">
              <Play className="size-5 translate-x-0.5" />
            </span>
          </span>
        ) : null}
      </button>

      {/* Meta: mentor avatar + title + views·comments */}
      <div className="flex gap-3">
        <Avatar size="sm" src={resolveAvatarUrl(s.mentorAvatarUrl)} name={s.mentorName} />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{s.title}</div>
          <div className="mt-0.5 truncate text-xs text-ink-muted">{s.mentorName}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-faint">
            <span>
              {compact(views)} {isLive ? 'watching' : 'views'}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3" /> {compact(s.chatCount)}
            </span>
            {!isLive && s.endedAt ? (
              <>
                <span>·</span>
                <span>{formatWhen(s.endedAt)}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Empty-state card that mirrors VideoCard's shape so the grid layout stays consistent. */
function PlaceholderVideoCard({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid aspect-video w-full place-items-center rounded-lg bg-surface-sunken ring-1 ring-border-subtle">
        <div className="flex flex-col items-center gap-2 text-ink-faint">
          <Video className="size-8" />
          <span className="px-3 text-center text-xs font-medium">{label}</span>
        </div>
      </div>
      <div className="flex gap-3">
        <span className="size-8 shrink-0 rounded-full bg-surface-sunken ring-1 ring-border-subtle" />
        <div className="min-w-0 flex-1 space-y-1.5 pt-1">
          <div className="h-3 w-3/4 rounded bg-surface-sunken" />
          <div className="h-2.5 w-1/2 rounded bg-surface-sunken" />
        </div>
      </div>
    </div>
  );
}

/** A single-placeholder grid — same columns as a populated section. */
function EmptyVideoGrid({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <PlaceholderVideoCard label={label} />
    </div>
  );
}

// --- Recordings (VOD) ---

/** Poster (thumbnail) URL derived from the HLS master URL by convention. */
function posterFor(recordingUrl: string | null): string | undefined {
  return recordingUrl ? recordingUrl.replace(/\/hls\/master\.m3u8$/, '/thumb.jpg') : undefined;
}

function formatWhen(value: string | null): string {
  if (!value) return 'Time TBA';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Time TBA';
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}
