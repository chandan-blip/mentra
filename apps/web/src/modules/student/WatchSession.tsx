import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Hand, MessageSquare, Users, Video } from 'lucide-react';
import { Avatar, Card } from '@mentra/ui';
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
  useSession,
  useSessionMessages,
  useWatchProgress,
} from '../../lib/live.js';
import { getStoredUser, resolveAvatarUrl } from '../../lib/auth.js';

/**
 * Watch page (`/live-sessions/:id`) — a YouTube-style detail page for one session in any
 * state: LIVE (LiveKit stage + realtime chat), a READY recording (HLS player + persisted
 * comments), or PENDING (upcoming/processing placeholder). The card grid links here.
 */
export function WatchSessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useSession(id ?? null);
  const back = () => navigate('/live-sessions');

  if (session.isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <BackButton onClick={back} />
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="aspect-video w-full animate-pulse rounded-lg bg-surface-sunken" />
            <div className="mt-3 h-5 w-2/3 animate-pulse rounded bg-surface-sunken" />
          </div>
          <div className="h-64 animate-pulse rounded-lg bg-surface-sunken" />
        </div>
      </div>
    );
  }

  if (session.isError || !session.data) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <BackButton onClick={back} />
        <Card className="text-sm text-ink-muted">This session could not be found.</Card>
      </div>
    );
  }

  const s = session.data;
  const ready = s.recordingStatus === 'ready' && Boolean(s.recordingUrl);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <BackButton onClick={back} />
      {s.status === 'live' ? (
        <LiveWatch session={s} />
      ) : ready ? (
        <RecordingWatch session={s} />
      ) : (
        <PendingWatch session={s} />
      )}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink"
    >
      <ArrowLeft className="size-4" /> Back to sessions
    </button>
  );
}

// --- Live ---

function LiveWatch({ session }: { session: LiveSessionView }) {
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

  const liveBadges = (
    <>
      <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-accent-red px-2.5 py-1 text-xs font-semibold text-white">
        <span className="size-1.5 animate-pulse rounded-full bg-white" /> LIVE · {elapsed}
      </span>
      <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs text-white">
        <Users className="size-3.5" /> {viewers}
      </span>
    </>
  );

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <Card className="overflow-hidden p-0">
          {conn ? (
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
                  {liveBadges}
                  {conn.canPublish ? <MediaControls camera={false} /> : null}
                </>
              }
              onLeft={() => navigate('/live-sessions')}
            />
          ) : (
            <div className="relative aspect-video" style={{ background: stageBg(hueOf(session.id)) }}>
              {liveBadges}
              <div className="grid h-full place-items-center text-sm text-white/70">
                {error ?? 'Connecting to the live stream…'}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink">{session.title}</div>
              <div className="mt-1 text-xs text-ink-faint">
                {session.mentorName} · {session.topic}
              </div>
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
        <Details session={session} live />
      </div>
      <LiveChat
        messages={socket.messages}
        selfUserId={selfId}
        onSend={socket.sendMessage}
        connected={socket.connected}
      />
    </div>
  );
}

// --- Recording (VOD) ---

function RecordingWatch({ session }: { session: LiveSessionView }) {
  // Fetch the saved position first so the player can seek to it on load.
  const progress = useWatchProgress(session.id);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        {session.recordingUrl && !progress.isLoading ? (
          <VideoPlayer
            src={session.recordingUrl}
            poster={posterFor(session.recordingUrl)}
            startAt={progress.data?.positionSeconds ?? 0}
            onProgress={(sec) => saveWatchProgress(session.id, sec)}
          />
        ) : (
          <div className="grid aspect-video w-full place-items-center rounded-lg bg-black text-sm text-white/70">
            Loading recording…
          </div>
        )}
        <Details session={session} />
      </div>
      <CommentsPanel session={session} />
    </div>
  );
}

// --- Pending (upcoming / processing) ---

function PendingWatch({ session: s }: { session: LiveSessionView }) {
  const processing = s.recordingStatus === 'recording' || s.recordingStatus === 'processing';
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <div
          className="grid aspect-video w-full place-items-center overflow-hidden rounded-lg text-white/80"
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
        <Details session={s} />
      </div>
      <CommentsPanel session={s} />
    </div>
  );
}

// --- Shared building blocks ---

/** Title + meta (views · comments · date) + mentor row beneath the player. */
function Details({ session: s, live }: { session: LiveSessionView; live?: boolean }) {
  const views = live ? s.currentViewers : s.peakViewers;
  return (
    <div className="mt-3">
      <h1 className="text-lg font-semibold leading-snug text-ink">{s.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
        <span>
          {compact(views)} {live ? 'watching' : 'views'}
        </span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="size-3" /> {compact(s.chatCount)}
        </span>
        {s.endedAt && !live ? (
          <>
            <span>·</span>
            <span>{formatWhen(s.endedAt)}</span>
          </>
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-3 border-t border-border-subtle pt-3">
        <Avatar size="sm" src={resolveAvatarUrl(s.mentorAvatarUrl)} name={s.mentorName} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{s.mentorName}</div>
          <div className="truncate text-xs text-ink-muted">{s.topic}</div>
        </div>
      </div>
    </div>
  );
}

/** Read-only comments for non-live sessions — the session's persisted chat history. */
function CommentsPanel({ session }: { session: LiveSessionView }) {
  const messages = useSessionMessages(session.id);
  const list = messages.data ?? [];
  return (
    <Card className="flex max-h-[72vh] flex-col p-0">
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3 text-sm font-semibold text-ink">
        <MessageSquare className="size-4 text-ink-muted" /> Comments
        <span className="text-ink-faint">{compact(list.length)}</span>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.isLoading ? (
          <div className="text-sm text-ink-faint">Loading comments…</div>
        ) : list.length === 0 ? (
          <div className="text-sm text-ink-faint">No comments yet.</div>
        ) : (
          list.map((m) => <CommentRow key={m.id} message={m} />)
        )}
      </div>
    </Card>
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
