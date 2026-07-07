import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Hand, Heart, MessageSquare, UserPlus, Users, Video } from 'lucide-react';
import { Avatar } from '@mentra/ui';
import type { ChatMessageView, JoinTokenResponse, LiveSessionView } from '@mentra/shared';
import { LiveChat } from '../../components/LiveChat.js';
import { VideoPlayer } from '../../components/VideoPlayer.js';
import { LiveStage, MediaControls } from '../../lib/livekit.js';
import { useLiveSocket } from '../../lib/socket.js';
import {
  hueOf,
  saveWatchProgress,
  stageBg,
  useElapsed,
  useJoinToken,
  useLiveSessions,
  usePastSessions,
  useSession,
  useSessionMessages,
  useToggleLike,
  useUpcoming,
  useWatchProgress,
} from '../../lib/live.js';
import { usePublicProfile, useToggleFollow } from '../../lib/profile.js';
import { useChrome } from '../../lib/chrome.js';
import { getStoredUser, resolveAvatarUrl } from '../../lib/auth.js';
import { VideoCard } from './LiveSessions.js';

/**
 * Watch page (`/live-sessions/:id`) — a mobile-first, immersive detail page for one
 * session in any state: LIVE (LiveKit stage + realtime chat), a READY recording (custom
 * HLS player + persisted comments), or PENDING (upcoming/processing placeholder).
 *
 * The app chrome (top bar + mobile bottom nav) is hidden here so the video owns the
 * screen; a slim back+channel header sits on top. Layout is one column: header → video →
 * title/stats → like·comment → (expandable) comments → more sessions.
 */
export function WatchSessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useSession(id ?? null);
  const back = () => navigate('/live-sessions');

  // Immersive: hide the shell chrome while this page is mounted (AppLayout skips its
  // scroll-watcher on this route, so this force-hide isn't fought).
  const { setHidden } = useChrome();
  useEffect(() => {
    setHidden(true);
    return () => setHidden(false);
  }, [setHidden]);

  if (session.isLoading) {
    return (
      <Frame onBack={back}>
        <div className="-mx-3 aspect-video w-full animate-pulse bg-surface-sunken sm:mx-0 sm:rounded-lg" />
        <div className="mt-3 h-5 w-2/3 animate-pulse rounded bg-surface-sunken" />
      </Frame>
    );
  }

  if (session.isError || !session.data) {
    return (
      <Frame onBack={back}>
        <div className="rounded-lg bg-surface-sunken p-6 text-center text-sm text-ink-muted">
          This session could not be found.
        </div>
      </Frame>
    );
  }

  const s = session.data;
  if (s.status === 'live') return <LiveWatch session={s} onBack={back} />;
  const ready = s.recordingStatus === 'ready' && Boolean(s.recordingUrl);
  return ready ? <RecordingWatch session={s} onBack={back} /> : <PendingWatch session={s} onBack={back} />;
}

/** Bare column wrapper + back button, used for the loading / error states. */
function Frame({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl pb-24">
      <div className="mb-2 flex items-center py-2">
        <BackButton onBack={onBack} />
      </div>
      {children}
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label="Back to sessions"
      className="grid size-10 shrink-0 place-items-center rounded-full text-ink transition hover:bg-surface-sunken"
    >
      <ArrowLeft className="size-5" />
    </button>
  );
}

/**
 * The shared single-column scaffold: sticky back+channel header, the media node
 * (full-bleed on mobile), the title/stats, a like·comment action bar, a collapsible
 * comments panel, and a "more sessions" grid.
 */
function WatchScaffold({
  session: s,
  onBack,
  media,
  live = false,
  liveViewers,
  comments,
  commentsCount,
  extraActions,
}: {
  session: LiveSessionView;
  onBack: () => void;
  media: ReactNode;
  live?: boolean;
  liveViewers?: number;
  comments: ReactNode;
  commentsCount: number;
  extraActions?: ReactNode;
}) {
  const [openComments, setOpenComments] = useState(false);
  const views = live ? (liveViewers ?? s.currentViewers) : s.peakViewers;

  return (
    <div className="mx-auto w-full max-w-2xl pb-24">
      {/* Sticky header: back + uploader + follow */}
      <header className="sticky top-0 z-20 -mx-3 -mt-3 flex items-center gap-2 bg-canvas/85 px-2 py-2 backdrop-blur sm:mx-0 sm:mt-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
        <BackButton onBack={onBack} />
        <Avatar size="sm" src={resolveAvatarUrl(s.mentorAvatarUrl)} name={s.mentorName} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">{s.mentorName}</div>
          <div className="truncate text-xs text-ink-faint">{s.topic}</div>
        </div>
        {!s.isOwner ? <FollowPill mentorId={s.mentorId} /> : null}
      </header>

      {/* Video — edge-to-edge on mobile, rounded card on larger screens */}
      <div className="-mx-3 overflow-hidden bg-black sm:mx-0 sm:rounded-lg">{media}</div>

      <div className="mt-3">
        <h1 className="text-base font-semibold leading-snug text-ink sm:text-lg">{s.title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
          <span>
            {compact(views)} {live ? 'watching' : 'views'}
          </span>
          {s.endedAt && !live ? (
            <>
              <span>·</span>
              <span>{formatWhen(s.endedAt)}</span>
            </>
          ) : null}
        </div>

        {/* Action bar: like + comment (+ any state-specific action) */}
        <div className="mt-3 flex items-center gap-2 border-y border-border-subtle py-2">
          <LikeButton session={s} />
          <button
            type="button"
            onClick={() => setOpenComments((v) => !v)}
            aria-expanded={openComments}
            className={pill(openComments)}
          >
            <MessageSquare className="size-4" /> {compact(commentsCount)}
          </button>
          {extraActions}
        </div>

        {openComments ? <div className="mt-3">{comments}</div> : null}

        <RelatedSessions currentId={s.id} />
      </div>
    </div>
  );
}

const pill = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ${
    active
      ? 'bg-surface-inverse text-ink-inverse ring-transparent'
      : 'bg-surface-sunken text-ink ring-border-subtle hover:ring-border-strong'
  }`;

// --- Like / Follow ---

function LikeButton({ session: s }: { session: LiveSessionView }) {
  const toggle = useToggleLike(s.id);
  const liked = s.likedByViewer;
  return (
    <button
      type="button"
      onClick={() => toggle.mutate(!liked)}
      disabled={toggle.isPending}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike' : 'Like'}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition disabled:opacity-60 ${
        liked
          ? 'bg-accent-red/10 text-accent-red ring-accent-red/30'
          : 'bg-surface-sunken text-ink ring-border-subtle hover:ring-border-strong'
      }`}
    >
      <Heart className={`size-4 ${liked ? 'fill-current' : ''}`} /> {compact(s.likeCount)}
    </button>
  );
}

/** Follow / unfollow the mentor. Loads the mentor's public profile for the follow state. */
function FollowPill({ mentorId }: { mentorId: string }) {
  const profile = usePublicProfile(mentorId);
  const toggle = useToggleFollow(mentorId);
  if (profile.data?.isSelf) return null;
  const following = profile.data?.isFollowedByViewer ?? false;
  return (
    <button
      type="button"
      onClick={() => toggle.mutate(!following)}
      disabled={toggle.isPending || profile.isLoading}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition disabled:opacity-60 ${
        following
          ? 'bg-surface-sunken text-ink ring-1 ring-border-subtle hover:ring-border-strong'
          : 'bg-surface-inverse text-ink-inverse hover:bg-ink'
      }`}
    >
      {following ? (
        <>
          <Check className="size-4" /> Following
        </>
      ) : (
        <>
          <UserPlus className="size-4" /> Follow
        </>
      )}
    </button>
  );
}

// --- Live ---

function LiveWatch({ session, onBack }: { session: LiveSessionView; onBack: () => void }) {
  const navigate = useNavigate();
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

  const badges = (
    <>
      <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-accent-red px-2.5 py-1 text-xs font-semibold text-white">
        <span className="size-1.5 animate-pulse rounded-full bg-white" /> LIVE · {elapsed}
      </span>
      <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs text-white">
        <Users className="size-3.5" /> {viewers}
      </span>
    </>
  );

  const media = conn ? (
    <LiveStage
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
          {badges}
          {conn.canPublish ? <MediaControls camera={false} /> : null}
        </>
      }
      onLeft={() => navigate('/live-sessions')}
    />
  ) : (
    <div className="relative aspect-video" style={{ background: stageBg(hueOf(session.id)) }}>
      {badges}
      <div className="grid h-full place-items-center text-sm text-white/70">
        {error ?? 'Connecting to the live stream…'}
      </div>
    </div>
  );

  const raiseHand = (
    <button
      type="button"
      onClick={() => {
        socket.raiseHand();
        setHandRaised(true);
      }}
      disabled={handRaised || conn?.canPublish}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition disabled:opacity-60 ${
        handRaised
          ? 'bg-accent-amber/15 text-accent-amber ring-accent-amber/30'
          : 'bg-surface-sunken text-ink ring-border-subtle hover:ring-border-strong'
      }`}
      title={conn?.canPublish ? 'You can speak' : handRaised ? 'Hand raised' : 'Raise your hand to ask'}
    >
      <Hand className="size-4" /> <span className="hidden sm:inline">Raise hand</span>
    </button>
  );

  return (
    <WatchScaffold
      session={session}
      onBack={onBack}
      media={media}
      live
      liveViewers={viewers}
      commentsCount={socket.messages.length || session.chatCount}
      extraActions={raiseHand}
      comments={
        <LiveChat
          messages={socket.messages}
          selfUserId={selfId}
          onSend={socket.sendMessage}
          connected={socket.connected}
        />
      }
    />
  );
}

// --- Recording (VOD) ---

function RecordingWatch({ session, onBack }: { session: LiveSessionView; onBack: () => void }) {
  // Fetch the saved position first so the player can seek to it on load.
  const progress = useWatchProgress(session.id);

  const media =
    session.recordingUrl && !progress.isLoading ? (
      <VideoPlayer
        src={session.recordingUrl}
        poster={posterFor(session.recordingUrl)}
        startAt={progress.data?.positionSeconds ?? 0}
        onProgress={(sec) => saveWatchProgress(session.id, sec)}
      />
    ) : (
      <div className="grid aspect-video w-full place-items-center bg-black text-sm text-white/70">
        Loading recording…
      </div>
    );

  return (
    <WatchScaffold
      session={session}
      onBack={onBack}
      media={media}
      commentsCount={session.chatCount}
      comments={<CommentsList session={session} />}
    />
  );
}

// --- Pending (upcoming / processing) ---

function PendingWatch({ session: s, onBack }: { session: LiveSessionView; onBack: () => void }) {
  const processing = s.recordingStatus === 'recording' || s.recordingStatus === 'processing';
  const media = (
    <div
      className="grid aspect-video w-full place-items-center overflow-hidden text-white/80"
      style={{ background: stageBg(hueOf(s.id)) }}
    >
      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <Video className="size-9" />
        <div className="text-sm font-medium">
          {processing
            ? 'This recording is still processing — check back shortly.'
            : s.scheduledFor
              ? `Starts ${formatWhen(s.scheduledFor)}`
              : 'This session hasn’t started yet.'}
        </div>
        {s.status === 'scheduled' ? (
          <div className="text-xs text-white/60">You’ll be able to watch here once it goes live.</div>
        ) : null}
      </div>
    </div>
  );

  return (
    <WatchScaffold
      session={s}
      onBack={onBack}
      media={media}
      commentsCount={s.chatCount}
      comments={<CommentsList session={s} />}
    />
  );
}

// --- Comments (persisted chat history, read-only) ---

function CommentsList({ session }: { session: LiveSessionView }) {
  const messages = useSessionMessages(session.id);
  const list = messages.data ?? [];
  return (
    <div className="rounded-xl bg-surface-sunken/50 p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <MessageSquare className="size-4 text-ink-muted" /> Comments
        <span className="text-ink-faint">{compact(list.length)}</span>
      </div>
      {messages.isLoading ? (
        <div className="text-sm text-ink-faint">Loading comments…</div>
      ) : list.length === 0 ? (
        <div className="text-sm text-ink-faint">No comments yet.</div>
      ) : (
        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          {list.map((m) => (
            <CommentRow key={m.id} message={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentRow({ message: m }: { message: ChatMessageView }) {
  return (
    <div className="flex gap-3">
      <Avatar size="sm" name={m.authorName} />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium text-ink">{m.authorName}</span>
          <span className="shrink-0 text-xs text-ink-faint">{formatWhen(m.createdAt)}</span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink-muted">{m.body}</p>
      </div>
    </div>
  );
}

// --- More sessions ---

function RelatedSessions({ currentId }: { currentId: string }) {
  const navigate = useNavigate();
  const live = useLiveSessions();
  const upcoming = useUpcoming();
  const past = usePastSessions();
  const all = [...(live.data ?? []), ...(upcoming.data ?? []), ...(past.data ?? [])].filter(
    (s) => s.id !== currentId,
  );
  if (all.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold text-ink">More sessions</h2>
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        {all.slice(0, 8).map((s) => (
          <VideoCard key={s.id} session={s} onOpen={() => navigate(`/live-sessions/${s.id}`)} />
        ))}
      </div>
    </section>
  );
}

// --- helpers ---

function compact(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

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
