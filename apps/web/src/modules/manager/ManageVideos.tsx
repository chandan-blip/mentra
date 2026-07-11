import { useRef, useState, type ReactNode } from 'react';
import type { LiveSessionView } from '@mentra/shared';
import { Check, Image as ImageIcon, Link2, Loader2, Pencil, Search, Sparkles, Trash2, Upload, Video, X } from 'lucide-react';
import { Switch } from '../../components/Switch.js';
import {
  useDeleteVideo,
  useManagedVideos,
  useRegenerateThumbnail,
  useSetVideoPublic,
  useSetVideoVisibility,
  useUpdateVideo,
  useUploadThumbnail,
} from '../../lib/videos.js';

/** The shareable public URL for a video (works only while the video is public). */
export const publicWatchUrl = (id: string): string =>
  typeof window !== 'undefined' ? `${window.location.origin}/watch/${id}` : `/watch/${id}`;

/** Poster fallback derived from the HLS master URL (same convention as the cards). */
function posterOf(v: LiveSessionView): string | undefined {
  if (v.thumbnailUrl) return v.thumbnailUrl;
  return v.recordingUrl ? v.recordingUrl.replace(/\/hls\/master\.m3u8$/, '/thumb.jpg') : undefined;
}

/**
 * Videos management ('manage-videos' module): a role-gated table of every recording +
 * upload. Edit title/topic, toggle visibility to students, delete, and manage the cover
 * (upload a custom image or regenerate the AI one).
 */
export function ManageVideosPage() {
  const [search, setSearch] = useState('');
  const videos = useManagedVideos(search);
  const [editing, setEditing] = useState<LiveSessionView | null>(null);
  const [cover, setCover] = useState<LiveSessionView | null>(null);

  const setVisible = useSetVideoVisibility();
  const setPublic = useSetVideoPublic();
  const del = useDeleteVideo();
  const [copied, setCopied] = useState<string | null>(null);

  const copyLink = async (id: string) => {
    try {
      await navigator.clipboard.writeText(publicWatchUrl(id));
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  const onDelete = (v: LiveSessionView) => {
    if (!window.confirm(`Delete “${v.title}”? This removes the video and its files permanently.`)) return;
    del.mutate(v.id);
  };

  const rows = videos.data ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-1 flex items-center gap-2">
        <Video className="size-5 text-ink-muted" />
        <h1 className="text-display-sm font-semibold text-ink">Manage Videos</h1>
      </div>
      <p className="mb-5 text-sm text-ink-faint">
        Edit titles, topics and covers, show or hide videos from students, or delete them.
      </p>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or topic…"
            className="auth-input-plain h-9 w-full pl-9"
          />
        </div>
        <span className="text-xs text-ink-faint">{rows.length} videos</span>
      </div>

      <div className="overflow-x-auto rounded-md ring-1 ring-border-subtle">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface-sunken text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Video</th>
              <th className="px-3 py-2 text-left font-medium">Topic</th>
              <th className="px-3 py-2 text-left font-medium">Mentor</th>
              <th className="px-3 py-2 text-center font-medium">Type</th>
              <th className="px-3 py-2 text-center font-medium">Status</th>
              <th className="px-3 py-2 text-center font-medium">Visible</th>
              <th className="px-3 py-2 text-center font-medium">Public</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className="border-t border-border-subtle">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-16 shrink-0 place-items-center overflow-hidden rounded bg-surface-sunken">
                      {posterOf(v) ? (
                        <img src={posterOf(v)} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <Video className="size-4 text-ink-faint" />
                      )}
                    </div>
                    <span className="line-clamp-2 max-w-[22rem] text-ink">{v.title}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-ink-muted">{v.topic}</td>
                <td className="px-3 py-2 text-ink-muted">{v.mentorName}</td>
                <td className="px-3 py-2 text-center">
                  <span className="rounded-sm bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted ring-1 ring-border-subtle">
                    {v.source === 'upload' ? 'Upload' : 'Live'}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <StatusBadge video={v} />
                </td>
                <td className="px-3 py-2 text-center">
                  <Switch
                    checked={v.visible}
                    disabled={setVisible.isPending}
                    onChange={(next) => setVisible.mutate({ id: v.id, visible: next })}
                    aria-label={`Toggle ${v.title} visible`}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1.5">
                    <Switch
                      checked={v.isPublic}
                      disabled={setPublic.isPending}
                      onChange={(next) => setPublic.mutate({ id: v.id, isPublic: next })}
                      aria-label={`Toggle ${v.title} public`}
                    />
                    {v.isPublic ? (
                      <button
                        type="button"
                        onClick={() => copyLink(v.id)}
                        title="Copy public link"
                        aria-label={`Copy public link for ${v.title}`}
                        className="rounded-md p-1 text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
                      >
                        {copied === v.id ? <Check className="size-4 text-accent-green" /> : <Link2 className="size-4" />}
                      </button>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(v)}
                      className="rounded-md p-1.5 text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
                      aria-label={`Edit ${v.title}`}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCover(v)}
                      className="rounded-md p-1.5 text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
                      aria-label={`Cover for ${v.title}`}
                    >
                      <ImageIcon className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(v)}
                      disabled={del.isPending}
                      className="rounded-md p-1.5 text-ink-muted transition hover:bg-accent-red/10 hover:text-accent-red disabled:opacity-50"
                      aria-label={`Delete ${v.title}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {videos.isLoading ? (
          <div className="p-6 text-center text-sm text-ink-faint">Loading videos…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-ink-faint">No videos yet.</div>
        ) : null}
      </div>

      {editing ? <EditModal video={editing} onClose={() => setEditing(null)} /> : null}
      {cover ? <CoverModal video={cover} onClose={() => setCover(null)} /> : null}
    </div>
  );
}

function StatusBadge({ video: v }: { video: LiveSessionView }) {
  // Live sessions show "live"; recorded/uploaded show their recording lifecycle; everything
  // else (scheduled/ended without a recording, canceled) shows the session status.
  const label = v.status === 'live' ? 'live' : (v.recordingStatus ?? v.status);
  const map: Record<string, string> = {
    live: 'bg-accent-red/10 text-accent-red ring-accent-red/20',
    ready: 'bg-accent-green/10 text-accent-green ring-accent-green/20',
    processing: 'bg-accent-amber/10 text-accent-amber ring-accent-amber/20',
    recording: 'bg-accent-amber/10 text-accent-amber ring-accent-amber/20',
    failed: 'bg-accent-red/10 text-accent-red ring-accent-red/20',
    scheduled: 'bg-surface-sunken text-ink-muted ring-border-subtle',
    ended: 'bg-surface-sunken text-ink-muted ring-border-subtle',
    canceled: 'bg-surface-sunken text-ink-faint ring-border-subtle',
  };
  const cls = map[label] ?? 'bg-surface-sunken text-ink-faint ring-border-subtle';
  return <span className={`rounded-sm px-2 py-0.5 text-xs ring-1 ${cls}`}>{label}</span>;
}

// --- Edit title/topic ---

function EditModal({ video, onClose }: { video: LiveSessionView; onClose: () => void }) {
  const [title, setTitle] = useState(video.title);
  const [topic, setTopic] = useState(video.topic);
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateVideo();

  const submit = () => {
    setError(null);
    update.mutate(
      { id: video.id, title: title.trim(), topic: topic.trim() },
      { onSuccess: onClose, onError: (e) => setError((e as Error).message) },
    );
  };

  return (
    <Modal title="Edit video" onClose={onClose}>
      {error ? (
        <div className="mb-3 rounded-md bg-accent-red/10 px-3 py-2 text-sm text-accent-red ring-1 ring-accent-red/20">
          {error}
        </div>
      ) : null}
      <Field label="Title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="auth-input-plain h-9 w-full" />
      </Field>
      <Field label="Topic">
        <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} className="auth-input-plain h-9 w-full" />
      </Field>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-9 rounded-md px-3 text-sm text-ink-muted transition hover:bg-surface-sunken">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={update.isPending || !title.trim() || !topic.trim()}
          className="flex h-9 items-center gap-1.5 rounded-md bg-surface-inverse px-3 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
        >
          {update.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Save
        </button>
      </div>
    </Modal>
  );
}

// --- Cover: upload custom or regenerate AI ---

function CoverModal({ video, onClose }: { video: LiveSessionView; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [regenerated, setRegenerated] = useState(false);
  const upload = useUploadThumbnail();
  const regen = useRegenerateThumbnail();
  const poster = posterOf(video);

  const onPick = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    upload.mutate({ id: video.id, file }, { onSuccess: onClose, onError: (e) => setError((e as Error).message) });
  };

  return (
    <Modal title="Cover image" onClose={onClose}>
      {error ? (
        <div className="mb-3 rounded-md bg-accent-red/10 px-3 py-2 text-sm text-accent-red ring-1 ring-accent-red/20">
          {error}
        </div>
      ) : null}

      <div className="mb-4 aspect-video w-full overflow-hidden rounded-md bg-surface-sunken ring-1 ring-border-subtle">
        {poster ? (
          <img src={poster} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-ink-faint">No cover yet</div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? undefined)}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-surface-inverse px-3 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
        >
          {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Upload image
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            regen.mutate(video.id, {
              onSuccess: () => setRegenerated(true),
              onError: (e) => setError((e as Error).message),
            });
          }}
          disabled={regen.isPending}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-surface-sunken px-3 text-sm font-semibold text-ink ring-1 ring-border-subtle transition hover:ring-border-strong disabled:opacity-50"
        >
          {regen.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Regenerate AI
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        {regenerated
          ? 'Regenerating — the new cover appears in a few seconds; reopen to check.'
          : 'PNG, JPEG or WebP, up to 5 MB. AI regeneration uses the title, topic and comments.'}
      </p>
    </Modal>
  );
}

// --- Shared modal + field ---

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas-deep/72 px-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-surface p-5 shadow-card ring-1 ring-border"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-ink-muted transition hover:bg-surface-sunken">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
