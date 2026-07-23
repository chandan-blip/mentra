import { Clock, PlayCircle, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Card } from '@mentra/ui';
import type { AttendedSessionView } from '@mentra/shared';
import { resolveAvatarUrl } from '../../lib/auth.js';
import { useAttendedSessions } from '../../lib/live.js';

/**
 * "My Sessions" settings tab — the live sessions the student has actually attended (joined),
 * newest first, with how long they watched and a link to rewatch the recording.
 */
export function MySessionsTab() {
  const { data, isLoading } = useAttendedSessions();

  if (isLoading) return <Card className="text-sm text-ink-muted">Loading your sessions…</Card>;
  const sessions = data ?? [];

  if (sessions.length === 0) {
    return (
      <Card className="text-sm text-ink-muted">
        You haven’t attended any live sessions yet. Join one from the{' '}
        <Link to="/live-sessions" className="font-medium text-ink underline underline-offset-2">Live Sessions</Link> page.
      </Card>
    );
  }

  return (
    <Card className="divide-y divide-border-subtle p-0">
      {sessions.map((s) => (
        <AttendedRow key={s.id} session={s} />
      ))}
    </Card>
  );
}

function AttendedRow({ session: s }: { session: AttendedSessionView }) {
  const canRewatch = s.recordingStatus === 'ready';
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-sunken text-ink-faint ring-1 ring-border-subtle">
        {s.mentorAvatarUrl ? (
          <img src={resolveAvatarUrl(s.mentorAvatarUrl)} alt={s.mentorName} className="h-full w-full object-cover" />
        ) : (
          <Video className="size-4" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{s.title}</div>
        <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-faint">
          <span>{s.mentorName}</span>
          <span>·</span>
          <span>{fmtDate(s.attendedAt)}</span>
          {s.attendedSeconds > 0 ? (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {fmtDuration(s.attendedSeconds)} watched</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {canRewatch ? (
          <Link
            to={`/live-sessions/${s.id}`}
            className="flex h-8 items-center gap-1.5 rounded-md bg-surface-inverse px-3 text-xs font-semibold text-ink-inverse transition hover:bg-ink"
          >
            <PlayCircle className="size-3.5" /> Rewatch
          </Link>
        ) : s.recordingStatus === 'processing' || s.recordingStatus === 'recording' ? (
          <Badge variant="warning" size="sm">Recording processing</Badge>
        ) : (
          <Badge variant="outline" size="sm">No recording</Badge>
        )}
      </div>
    </div>
  );
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}
