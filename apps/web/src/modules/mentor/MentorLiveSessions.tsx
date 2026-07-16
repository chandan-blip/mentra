import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { PageHeader } from '../../components/PageHeader.js';
import { ArrowLeft, BarChart3, Calendar, Radio, Upload, Users, Video } from 'lucide-react';
import { Badge, Card } from '@mentra/ui';
import type { JoinTokenResponse, LiveSessionView } from '@mentra/shared';
import { MAX_UPLOAD_BYTES } from '@mentra/shared';
import { LiveChat } from '../../components/LiveChat.js';
import { LiveStage, MediaControls } from '../../lib/livekit.js';
import { useLiveSocket } from '../../lib/socket.js';
import {
  formatDuration,
  hueOf,
  stageBg,
  useCreateSession,
  useCreateUpload,
  useElapsed,
  useEndSession,
  useFinalizeUpload,
  useJoinToken,
  useMyMentorSessions,
  useSessionSummary,
  useStartSession,
  uploadFileToR2,
} from '../../lib/live.js';
import { getStoredUser } from '../../lib/auth.js';
import { useMyAccess } from '../../lib/access.js';

/**
 * Mentor Live Sessions — the BROADCAST side. Mentors (and admins) go live here on
 * the LiveKit SFU; students watch from the student Live Sessions module. After a
 * session ends, the mentor sees a recorded report (attendance, viewers, chat count).
 */

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

export function MentorLiveSessionsPage() {
  const { data: access } = useMyAccess();
  const canBroadcast = access?.roleId === 'mentor' || access?.isAdmin === true;

  const sessions = useMyMentorSessions();
  const create = useCreateSession();
  const start = useStartSession();

  const [live, setLive] = useState<LiveSessionView | null>(null);
  const [report, setReport] = useState<LiveSessionView | null>(null);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [schedAt, setSchedAt] = useState('');

  if (live) return <Broadcaster session={live} onEnd={() => setLive(null)} />;
  if (report) return <Report session={report} onBack={() => setReport(null)} />;

  async function goLiveNow() {
    if (!title.trim()) return;
    const session = await create.mutateAsync({ title: title.trim(), topic: topic.trim() || 'General' });
    const started = await start.mutateAsync(session.id);
    setTitle('');
    setTopic('');
    setLive(started);
  }

  async function scheduleLater() {
    if (!title.trim() || !schedAt) return;
    await create.mutateAsync({
      title: title.trim(),
      topic: topic.trim() || 'General',
      scheduledFor: new Date(schedAt).toISOString(),
    });
    setTitle('');
    setTopic('');
    setSchedAt('');
  }

  const all = sessions.data ?? [];
  const scheduled = all.filter((s) => s.status === 'scheduled');
  const ended = all.filter((s) => s.status === 'ended' || s.status === 'canceled');
  const liveOnes = all.filter((s) => s.status === 'live');

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto w-full max-w-3xl space-y-5"
    >
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-3">
        <PageHeader
          icon={<Radio />}
          title="Go Live"
          subtitle="Start a live session — your students watch from their Live Sessions tab."
        />
      </motion.div>

      {!canBroadcast ? (
        <motion.div variants={fadeUp}>
          <Card>
            <div className="text-sm font-medium text-ink">Mentors only</div>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              Broadcasting is for mentors. To watch live sessions, open the Live Sessions tab.
            </p>
          </Card>
        </motion.div>
      ) : (
        <>
          <motion.div variants={fadeUp}>
            <Card className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-muted">Session title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Graphs deep-dive — BFS & DFS"
                  className="auth-input-plain h-11 w-full"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-muted">Topic</label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. DSA, System Design, Interview"
                  className="auth-input-plain h-11 w-full"
                />
              </div>

              <button
                type="button"
                onClick={goLiveNow}
                disabled={!title.trim() || create.isPending || start.isPending}
                className="flex h-11 items-center justify-center gap-2 rounded-md bg-accent-red px-6 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                <Radio className="size-4" /> {create.isPending || start.isPending ? 'Starting…' : 'Go live now'}
              </button>

              <div className="flex items-center gap-3 text-xs text-ink-faint">
                <span className="h-px flex-1 bg-border-subtle" /> or schedule for later <span className="h-px flex-1 bg-border-subtle" />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="datetime-local"
                  value={schedAt}
                  onChange={(e) => setSchedAt(e.target.value)}
                  className="auth-input-plain h-11 flex-1"
                />
                <button
                  type="button"
                  onClick={scheduleLater}
                  disabled={!title.trim() || !schedAt || create.isPending}
                  className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
                >
                  <Calendar className="size-4" /> Schedule
                </button>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={fadeUp}>
            <UploadRecordingCard />
          </motion.div>

          {liveOnes.length > 0 ? (
            <motion.div variants={fadeUp}>
              <div className="mb-3 flex items-center gap-2">
                <span className="size-2 animate-pulse rounded-full bg-accent-red" />
                <h2 className="text-sm font-medium text-ink">Currently live</h2>
              </div>
              <Card className="divide-y divide-border-subtle p-0">
                {liveOnes.map((s) => (
                  <Row key={s.id} session={s}>
                    <button
                      type="button"
                      onClick={() => setLive(s)}
                      className="h-8 shrink-0 rounded-md bg-accent-red px-3 text-xs font-semibold text-white transition hover:brightness-110"
                    >
                      Resume
                    </button>
                  </Row>
                ))}
              </Card>
            </motion.div>
          ) : null}

          <motion.div variants={fadeUp}>
            <div className="mb-3 flex items-center gap-2">
              <Calendar className="size-4 text-ink-muted" />
              <h2 className="text-sm font-medium text-ink">Scheduled</h2>
              <span className="text-xs text-ink-faint">{scheduled.length}</span>
            </div>
            {scheduled.length === 0 ? (
              <Card className="text-sm text-ink-muted">No sessions scheduled yet — pick a date above.</Card>
            ) : (
              <Card className="divide-y divide-border-subtle p-0">
                {scheduled.map((s) => (
                  <Row key={s.id} session={s}>
                    <StartButton session={s} onLive={setLive} />
                  </Row>
                ))}
              </Card>
            )}
          </motion.div>

          {ended.length > 0 ? (
            <motion.div variants={fadeUp}>
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="size-4 text-ink-muted" />
                <h2 className="text-sm font-medium text-ink">Past sessions</h2>
              </div>
              <Card className="divide-y divide-border-subtle p-0">
                {ended.map((s) => (
                  <Row key={s.id} session={s}>
                    <button
                      type="button"
                      onClick={() => setReport(s)}
                      className="h-8 shrink-0 rounded-md bg-surface-sunken px-3 text-xs font-medium text-ink ring-1 ring-border-subtle transition hover:ring-border-strong"
                    >
                      View report
                    </button>
                  </Row>
                ))}
              </Card>
            </motion.div>
          ) : null}
        </>
      )}
    </motion.div>
  );
}

/**
 * Upload a pre-recorded video (≤1 GB). The browser PUTs the file straight to R2 via a
 * presigned URL, then we finalize → the same FFmpeg HLS pipeline transcodes it, and it
 * shows up in students' recordings once ready.
 */
function UploadRecordingCard() {
  const createUpload = useCreateUpload();
  const finalize = useFinalizeUpload();
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null); // 0..1 while uploading
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tooBig = file ? file.size > MAX_UPLOAD_BYTES : false;
  const busy = progress !== null || finalize.isPending;

  function pick(f: File | null) {
    setError(null);
    setDone(false);
    setFile(f);
  }

  async function upload() {
    if (!file || !title.trim() || tooBig || busy) return;
    setError(null);
    setDone(false);
    const contentType = file.type || 'video/mp4';
    try {
      setProgress(0);
      const init = await createUpload.mutateAsync({
        title: title.trim(),
        topic: topic.trim() || 'General',
        contentType,
      });
      await uploadFileToR2(init.uploadUrl, file, contentType, setProgress);
      await finalize.mutateAsync(init.session.id);
      setProgress(null);
      setDone(true);
      setTitle('');
      setTopic('');
      setFile(null);
    } catch (e) {
      setProgress(null);
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Upload className="size-4 text-ink-muted" />
        <h2 className="text-sm font-medium text-ink">Upload a recording</h2>
        <span className="text-xs text-ink-faint">up to 1 GB</span>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-ink-muted">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Recorded: Dynamic Programming masterclass"
          className="auth-input-plain h-11 w-full"
          disabled={busy}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-ink-muted">Topic</label>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. DSA, System Design, Interview"
          className="auth-input-plain h-11 w-full"
          disabled={busy}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-ink-muted">Video file</label>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          disabled={busy}
          className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-sunken file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-surface-raised"
        />
        {file ? (
          <p className={`mt-1.5 text-xs ${tooBig ? 'text-accent-red' : 'text-ink-faint'}`}>
            {file.name} · {formatBytes(file.size)}
            {tooBig ? ' — exceeds the 1 GB limit' : ''}
          </p>
        ) : null}
      </div>

      {progress !== null ? (
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-accent-blue transition-[width] duration-150"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-faint">
            {finalize.isPending ? 'Finalizing…' : `Uploading… ${Math.round(progress * 100)}%`}
          </p>
        </div>
      ) : null}

      {error ? <p className="text-xs text-accent-red">{error}</p> : null}
      {done ? (
        <p className="text-xs text-accent-green">
          Uploaded — it’s transcoding now and will appear in students’ recordings once ready.
        </p>
      ) : null}

      <button
        type="button"
        onClick={upload}
        disabled={!file || !title.trim() || tooBig || busy}
        className="flex h-11 items-center justify-center gap-2 rounded-md bg-accent-blue px-6 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        <Upload className="size-4" /> {busy ? 'Uploading…' : 'Upload recording'}
      </button>
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function Row({ session, children }: { session: LiveSessionView; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-md text-white" style={{ background: stageBg(hueOf(session.id)) }}>
        <Video className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{session.title}</div>
        <div className="text-xs text-ink-faint">{session.topic} · {labelFor(session)}</div>
      </div>
      <span
        className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-ink-faint"
        title={`${session.likeCount} ${session.likeCount === 1 ? 'student has' : 'students have'} enrolled`}
      >
        <Users className="size-3.5" /> {session.likeCount}
      </span>
      {children}
    </div>
  );
}

function StartButton({ session, onLive }: { session: LiveSessionView; onLive: (s: LiveSessionView) => void }) {
  const start = useStartSession();
  return (
    <button
      type="button"
      onClick={async () => onLive(await start.mutateAsync(session.id))}
      disabled={start.isPending}
      className="h-8 shrink-0 rounded-md bg-accent-red px-3 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
    >
      {start.isPending ? 'Starting…' : 'Go live'}
    </button>
  );
}

function Broadcaster({ session, onEnd }: { session: LiveSessionView; onEnd: () => void }) {
  const selfId = getStoredUser()?.id ?? null;
  const join = useJoinToken();
  const end = useEndSession();
  const [conn, setConn] = useState<JoinTokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socket = useLiveSocket(session.id);
  const elapsed = useElapsed(session.startedAt);
  const viewers = socket.viewerCount || session.currentViewers;

  useEffect(() => {
    let active = true;
    join.mutate(session.id, {
      onSuccess: (c) => active && setConn(c),
      onError: (e: unknown) => active && setError(e instanceof Error ? e.message : 'Could not start broadcast'),
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  async function endSession() {
    await end.mutateAsync(session.id);
    onEnd();
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <button onClick={onEnd} type="button" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink">
        <ArrowLeft className="size-4" /> Back
      </button>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden p-0">
          {conn ? (
            <LiveStage
              token={conn.token}
              wsUrl={conn.wsUrl}
              publish
              mentorId={session.mentorId}
              mentorName={session.mentorName}
              onMuteStudent={socket.muteParticipant}
              placeholderBg={stageBg(hueOf(session.id))}
              overlay={
                <>
                  <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-accent-red px-2.5 py-1 text-xs font-semibold text-white">
                    <span className="size-1.5 animate-pulse rounded-full bg-white" /> LIVE · {elapsed}
                  </span>
                  <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs text-white">
                    <Users className="size-3.5" /> {viewers}
                  </span>
                  <MediaControls />
                </>
              }
            />
          ) : (
            <div className="relative aspect-video" style={{ background: stageBg(hueOf(session.id)) }}>
              <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-accent-red px-2.5 py-1 text-xs font-semibold text-white">
                <span className="size-1.5 animate-pulse rounded-full bg-white" /> LIVE · {elapsed}
              </span>
              <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs text-white">
                <Users className="size-3.5" /> {viewers}
              </span>
              <div className="grid h-full place-items-center text-sm text-white/70">{error ?? 'Connecting your camera…'}</div>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink">{session.title}</div>
              <div className="text-xs text-ink-faint">You&apos;re live · students are watching</div>
            </div>
            <button
              type="button"
              onClick={endSession}
              disabled={end.isPending}
              className="h-10 rounded-md bg-accent-red px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {end.isPending ? 'Ending…' : 'End session'}
            </button>
          </div>
        </Card>
        <LiveChat
          messages={socket.messages}
          selfUserId={selfId}
          onSend={socket.sendMessage}
          hands={socket.hands}
          onApprove={socket.approveHand}
          connected={socket.connected}
        />
      </div>
    </div>
  );
}

function Report({ session, onBack }: { session: LiveSessionView; onBack: () => void }) {
  const summary = useSessionSummary(session.id);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <button onClick={onBack} type="button" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink">
        <ArrowLeft className="size-4" /> Back
      </button>
      <h1 className="flex items-center gap-2 text-display-sm tracking-normal">
        <BarChart3 className="size-5 text-ink-muted" /> Session report
      </h1>
      <p className="mt-1 text-sm text-ink-muted">{session.title}</p>

      {summary.isLoading ? (
        <Card className="mt-5 text-sm text-ink-muted">Loading report…</Card>
      ) : summary.data ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Enrolled" value={String(session.likeCount)} />
            <Stat label="Peak viewers" value={String(summary.data.session.peakViewers)} />
            <Stat label="Chat messages" value={String(summary.data.chatCount)} />
            <Stat label="Attendees" value={String(summary.data.attendees.length)} />
          </div>

          <div className="mt-5">
            <div className="mb-3 flex items-center gap-2">
              <Users className="size-4 text-ink-muted" />
              <h2 className="text-sm font-medium text-ink">Attendance</h2>
            </div>
            {summary.data.attendees.length === 0 ? (
              <Card className="text-sm text-ink-muted">No students attended this session.</Card>
            ) : (
              <Card className="divide-y divide-border-subtle p-0">
                {summary.data.attendees.map((a) => (
                  <div key={a.userId} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">{a.name}</div>
                      <div className="text-xs text-ink-faint">Joined {formatTime(a.firstJoin)}</div>
                    </div>
                    <Badge variant="outline" size="md">{formatDuration(a.attendedSeconds)}</Badge>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </>
      ) : (
        <Card className="mt-5 text-sm text-ink-muted">Could not load the report.</Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-2xl font-semibold text-ink">{value}</div>
      <div className="mt-1 text-xs text-ink-faint">{label}</div>
    </Card>
  );
}

function labelFor(session: LiveSessionView): string {
  if (session.status === 'scheduled') return session.scheduledFor ? formatTime(session.scheduledFor) : 'Not scheduled';
  if (session.status === 'live') return 'Live now';
  if (session.endedAt) return `Ended ${formatTime(session.endedAt)}`;
  return session.status;
}

function formatTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}
