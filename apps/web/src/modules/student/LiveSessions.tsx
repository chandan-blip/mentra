import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { PageHeader } from '../../components/PageHeader.js';
import { ArrowLeft, Calendar, Clock, Hand, Play, Ticket, UserRound, Users, Video } from 'lucide-react';
import { Badge, Card } from '@mentra/ui';
import type { BookingJoinResponse, JoinTokenResponse, LiveSessionView, MentorBookingView } from '@mentra/shared';
import { LiveChat } from '../../components/LiveChat.js';
import { CallStage, LiveStage, MediaControls } from '../../lib/livekit.js';
import { useLiveSocket } from '../../lib/socket.js';
import {
  hueOf,
  stageBg,
  useElapsed,
  useJoinToken,
  useLiveSessions,
  usePastSessions,
  useUpcoming,
} from '../../lib/live.js';
import {
  avatarBg,
  formatSlot,
  hueOf as mentorHue,
  useBookingJoinToken,
  useMyBookings,
  useOpenSessions,
} from '../../lib/mentors.js';
import { CheckoutModal, SessionCard as MentorSessionCard, sessionToCheckout, type CheckoutTarget } from './Mentors.js';
import { getStoredUser } from '../../lib/auth.js';

/**
 * Student Live Sessions — watch mentors teach live (LiveKit SFU) and chat in real
 * time (Socket.IO). Mentors broadcast from the separate Mentor Live Sessions module.
 */

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

export function LiveSessionsPage() {
  const [watching, setWatching] = useState<LiveSessionView | null>(null);
  const [call, setCall] = useState<{ join: BookingJoinResponse; title: string } | null>(null);
  const [checkout, setCheckout] = useState<CheckoutTarget | null>(null);
  const live = useLiveSessions();
  const upcoming = useUpcoming();
  const past = usePastSessions();
  const bookings = useMyBookings();
  const openSessions = useOpenSessions();
  const joinToken = useBookingJoinToken();

  if (watching) {
    return <Viewer session={watching} onLeave={() => setWatching(null)} />;
  }

  const liveSessions = live.data ?? [];
  const upcomingSessions = upcoming.data ?? [];
  const pastSessions = past.data ?? [];
  const sessionsToBook = openSessions.data ?? [];
  // Student's booked mentor sessions that are still ahead (not cancelled/done).
  const mentorBookings = (bookings.data ?? []).filter(
    (b) => (b.status === 'confirmed' || b.status === 'pending_payment') && new Date(b.endsAt).getTime() > Date.now(),
  );

  async function joinBooking(b: MentorBookingView) {
    const conn = await joinToken.mutateAsync(b.id);
    setCall({ join: conn, title: `${b.mentorName} · ${b.topic}` });
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto w-full max-w-8xl space-y-6"
    >
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-3">
        <PageHeader
          icon={<Video />}
          title="Live Sessions"
          subtitle="Watch mentors teach live and ask questions in real time."
        />
      </motion.div>

      <motion.div variants={fadeUp}>
        <div className="mb-3 flex items-center gap-2">
          <span className="size-2 animate-pulse rounded-full bg-accent-red" />
          <h2 className="text-sm font-medium text-ink">Live now</h2>
          <span className="text-xs text-ink-faint">{liveSessions.length} sessions</span>
        </div>
        {live.isLoading ? (
          <Card className="text-sm text-ink-muted">Loading live sessions…</Card>
        ) : liveSessions.length === 0 ? (
          <Card className="text-sm text-ink-muted">No one is live right now — check the upcoming list below.</Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {liveSessions.map((s) => (
              <SessionCard key={s.id} session={s} onWatch={() => setWatching(s)} />
            ))}
          </div>
        )}
      </motion.div>

      <motion.div variants={fadeUp}>
        <div className="mb-3 flex items-center gap-2">
          <UserRound className="size-4 text-ink-muted" />
          <h2 className="text-sm font-medium text-ink">Book a mentor session</h2>
          <span className="text-xs text-ink-faint">{sessionsToBook.length}</span>
        </div>
        {openSessions.isLoading ? (
          <Card className="text-sm text-ink-muted">Loading sessions…</Card>
        ) : sessionsToBook.length === 0 ? (
          <Card className="text-sm text-ink-muted">No mentor sessions are open right now.</Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sessionsToBook.map((s) => (
              <MentorSessionCard
                key={s.slotId}
                session={s}
                onBook={(x) => setCheckout(sessionToCheckout(x))}
                onJoined={(join, title) => setCall({ join, title })}
              />
            ))}
          </div>
        )}
      </motion.div>

      <motion.div variants={fadeUp}>
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="size-4 text-ink-muted" />
          <h2 className="text-sm font-medium text-ink">Upcoming</h2>
        </div>
        {upcomingSessions.length === 0 && mentorBookings.length === 0 ? (
          <Card className="text-sm text-ink-muted">No upcoming sessions scheduled yet.</Card>
        ) : (
          <Card className="divide-y divide-border-subtle p-0">
            {upcomingSessions.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-md text-white"
                  style={{ background: stageBg(hueOf(u.id)) }}
                >
                  <Video className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{u.title}</div>
                  <div className="text-xs text-ink-faint">
                    {u.mentorName} · {u.topic} · {formatWhen(u.scheduledFor)}
                  </div>
                </div>
              </div>
            ))}
            {mentorBookings.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-md text-white"
                  style={{ background: avatarBg(mentorHue(b.mentorId)) }}
                >
                  {b.kind === 'group' ? <Users className="size-4" /> : <UserRound className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{b.topic}</div>
                  <div className="text-xs text-ink-faint">
                    {b.mentorName} · {b.kind === 'group' ? 'Group' : '1:1'} mentor session · {formatSlot(b.startsAt)}
                  </div>
                </div>
                {b.status === 'confirmed' && b.joinCode ? (
                  <button
                    type="button"
                    onClick={() => joinBooking(b)}
                    disabled={joinToken.isPending}
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-accent-blue px-3 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                  >
                    <Video className="size-3.5" /> Join
                  </button>
                ) : (
                  <Badge variant="warning" size="sm">
                    <Ticket className="size-3" /> Awaiting approval
                  </Badge>
                )}
              </div>
            ))}
          </Card>
        )}
      </motion.div>

      <motion.div variants={fadeUp}>
        <div className="mb-3 flex items-center gap-2">
          <Clock className="size-4 text-ink-muted" />
          <h2 className="text-sm font-medium text-ink">Past sessions</h2>
        </div>
        {pastSessions.length === 0 ? (
          <Card className="text-sm text-ink-muted">No past sessions yet.</Card>
        ) : (
          <Card className="divide-y divide-border-subtle p-0">
            {pastSessions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-md text-white"
                  style={{ background: stageBg(hueOf(s.id)) }}
                >
                  <Video className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{s.title}</div>
                  <div className="text-xs text-ink-faint">
                    {s.mentorName} · {s.topic} · ended {formatWhen(s.endedAt)}
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-faint" title="Peak viewers">
                  <Users className="size-3.5" /> {s.peakViewers}
                </span>
              </div>
            ))}
          </Card>
        )}
      </motion.div>

      {call ? <BookingCallOverlay join={call.join} title={call.title} onClose={() => setCall(null)} /> : null}
      {checkout ? (
        <CheckoutModal mentor={checkout.mentor} presetSlotId={checkout.presetSlotId} onClose={() => setCheckout(null)} onDone={() => setCheckout(null)} />
      ) : null}
    </motion.div>
  );
}

/** Full-screen overlay hosting a booked mentor session's LiveKit call. */
function BookingCallOverlay({ join, title, onClose }: { join: BookingJoinResponse; title: string; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{title}</div>
          <div className="text-xs text-ink-faint">{join.kind === 'group' ? 'Group session' : '1:1 session'}</div>
        </div>
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-md bg-surface-sunken px-3 py-1.5 text-sm font-medium text-ink ring-1 ring-border-subtle transition hover:ring-border-strong">
          <ArrowLeft className="size-4" /> Leave
        </button>
      </header>
      <div className="flex flex-1 items-center justify-center overflow-auto p-4">
        <div className="w-full max-w-5xl">
          {join.kind === 'one_to_one' ? (
            <CallStage token={join.token} wsUrl={join.wsUrl} onLeft={onClose} />
          ) : (
            <LiveStage token={join.token} wsUrl={join.wsUrl} publish={join.canPublish} mentorId={join.mentorId} mentorName={join.mentorName} onLeft={onClose} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SessionCard({ session, onWatch }: { session: LiveSessionView; onWatch: () => void }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="relative aspect-video" style={{ background: stageBg(hueOf(session.id)) }}>
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-semibold text-white ring-1 ring-white/20">
          <span className="size-1.5 animate-pulse rounded-full bg-accent-red" /> LIVE
        </span>
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-white">
          <Users className="size-3" /> {session.currentViewers}
        </span>
        <button type="button" onClick={onWatch} className="group absolute inset-0 grid place-items-center" aria-label={`Watch ${session.title}`}>
          <span className="grid size-12 place-items-center rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur transition group-hover:scale-105 group-hover:bg-white/25">
            <Play className="size-5 translate-x-0.5 text-white" />
          </span>
        </button>
      </div>
      <div className="p-4">
        <div className="text-sm font-semibold text-ink">{session.title}</div>
        <div className="mt-1 text-xs text-ink-faint">{session.mentorName} · {session.topic}</div>
        <button
          type="button"
          onClick={onWatch}
          className="mt-3 h-9 w-full rounded-md bg-surface-inverse text-sm font-semibold text-ink-inverse transition hover:bg-ink"
        >
          Watch live
        </button>
      </div>
    </Card>
  );
}

function Viewer({ session, onLeave }: { session: LiveSessionView; onLeave: () => void }) {
  const selfId = getStoredUser()?.id ?? null;
  const join = useJoinToken();
  const [conn, setConn] = useState<JoinTokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handRaised, setHandRaised] = useState(false);
  const socket = useLiveSocket(session.id);
  const elapsed = useElapsed(session.startedAt);
  const viewers = socket.viewerCount || session.currentViewers;

  useEffect(() => {
    let active = true;
    join.mutate(session.id, {
      onSuccess: (c) => active && setConn(c),
      onError: (e: unknown) => active && setError(e instanceof Error ? e.message : 'Could not join'),
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  // A mentor approving your raised hand re-mints a publish token; reconnect with it.
  useEffect(() => {
    socket.onPromoted((grant) => {
      setConn(grant);
      setHandRaised(false);
    });
  }, [socket]);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <button onClick={onLeave} type="button" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink">
        <ArrowLeft className="size-4" /> Back to sessions
      </button>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden p-0">
          {conn ? (
            <LiveStage
              // Re-key on the publish flag so a raised-hand approval (which swaps in a
              // publish-capable token) fully remounts and reconnects to LiveKit with
              // the new grant — otherwise the mic toggle stays silently denied.
              key={conn.canPublish ? 'speak' : 'watch'}
              token={conn.token}
              wsUrl={conn.wsUrl}
              publish={conn.canPublish}
              publishVideo={false}
              mentorId={session.mentorId}
              mentorName={session.mentorName}
              placeholderBg={stageBg(hueOf(session.id))}
              overlay={
                <>
                  <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-accent-red px-2.5 py-1 text-xs font-semibold text-white">
                    <span className="size-1.5 animate-pulse rounded-full bg-white" /> LIVE · {elapsed}
                  </span>
                  <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs text-white">
                    <Users className="size-3.5" /> {viewers}
                  </span>
                  {conn.canPublish ? <MediaControls camera={false} /> : null}
                </>
              }
              onLeft={onLeave}
            />
          ) : (
            <div className="relative aspect-video" style={{ background: stageBg(hueOf(session.id)) }}>
              <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-accent-red px-2.5 py-1 text-xs font-semibold text-white">
                <span className="size-1.5 animate-pulse rounded-full bg-white" /> LIVE · {elapsed}
              </span>
              <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs text-white">
                <Users className="size-3.5" /> {viewers}
              </span>
              <div className="grid h-full place-items-center text-sm text-white/70">
                {error ?? 'Connecting to the live stream…'}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink">{session.title}</div>
              <div className="mt-1 text-xs text-ink-faint">{session.mentorName} · {session.topic}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                socket.raiseHand();
                setHandRaised(true);
              }}
              disabled={handRaised || conn?.canPublish}
              aria-label="Raise your hand to ask"
              title={conn?.canPublish ? 'You can speak' : handRaised ? 'Hand raised' : 'Raise your hand to ask'}
              className={`grid size-9 shrink-0 place-items-center rounded-md ring-1 transition disabled:opacity-60 ${
                handRaised
                  ? 'bg-accent-amber/15 text-accent-amber ring-accent-amber/30'
                  : 'bg-surface-sunken text-ink ring-border-subtle hover:ring-border-strong'
              }`}
            >
              <Hand className="size-4" />
            </button>
          </div>
        </Card>
        <LiveChat
          messages={socket.messages}
          selfUserId={selfId}
          onSend={socket.sendMessage}
          connected={socket.connected}
        />
      </div>
    </div>
  );
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
