import { useRef, useState } from 'react';
import { ImageIcon, Loader2, Trash2, Upload, Video } from 'lucide-react';
import type { ReviewMediaType, StudentReviewView } from '@mentra/shared';
import { Card } from '@mentra/ui';
import { Switch } from '../../components/Switch.js';
import {
  useDeleteReview,
  useManagedReviews,
  useUpdateReview,
  useUploadReview,
} from '../../lib/reviews.js';

/** Detect the review media kind from a picked file, or null if unsupported. */
function mediaTypeOf(file: File): ReviewMediaType | null {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  return null;
}

/**
 * Manage Reviews (manager). Upload student review videos & screenshots and manage the
 * gallery students see at /reviews — toggle visibility or delete.
 */
export function ManageReviewsPage() {
  const { data: reviews, isLoading } = useManagedReviews();

  return (
    <div className="mx-auto w-full max-w-8xl">
      <h1 className="text-display-sm tracking-normal md:text-display-md">Manage Reviews</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Upload student review videos and screenshots. Visible ones appear to students under Feedbacks &amp; Reviews.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <UploadCard />
        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Uploaded reviews {reviews ? <span className="text-ink-faint">({reviews.length})</span> : null}
          </h2>
          {isLoading ? (
            <p className="text-sm text-ink-muted">Loading…</p>
          ) : !reviews || reviews.length === 0 ? (
            <div className="rounded-xl bg-surface-sunken py-12 text-center text-sm text-ink-muted ring-1 ring-border-subtle">
              No reviews uploaded yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {reviews.map((r) => (
                <ReviewRow key={r.id} review={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadCard() {
  const upload = useUploadReview();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [studentName, setStudentName] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const kind = file ? mediaTypeOf(file) : null;
  const canSubmit = title.trim().length > 0 && file !== null && kind !== null && !upload.isPending;

  function reset() {
    setTitle('');
    setStudentName('');
    setBody('');
    setFile(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = '';
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) return;
    const mediaType = mediaTypeOf(file);
    if (!mediaType) {
      setError('Please choose a video or image file.');
      return;
    }
    setProgress(0);
    upload.mutate(
      {
        meta: {
          title: title.trim(),
          studentName: studentName.trim() || undefined,
          body: body.trim() || undefined,
          mediaType,
        },
        file,
        onProgress: setProgress,
      },
      {
        onSuccess: () => reset(),
        onError: (err) => setError((err as Error).message),
      },
    );
  }

  return (
    <Card className="h-fit">
      <h2 className="text-sm font-semibold text-ink">Upload a review</h2>
      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Landed a frontend role at Acme"
            className="w-full rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink ring-1 ring-border-subtle focus:outline-none focus:ring-2 focus:ring-ink"
          />
        </Field>
        <Field label="Student name (optional)">
          <input
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="e.g. Priya S."
            className="w-full rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink ring-1 ring-border-subtle focus:outline-none focus:ring-2 focus:ring-ink"
          />
        </Field>
        <Field label="Caption (optional)">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="A short quote from the student…"
            className="w-full resize-none rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink ring-1 ring-border-subtle focus:outline-none focus:ring-2 focus:ring-ink"
          />
        </Field>

        <Field label="Video or screenshot">
          <input
            ref={fileRef}
            type="file"
            accept="video/*,image/*"
            onChange={(e) => {
              setError(null);
              setFile(e.target.files?.[0] ?? null);
            }}
            className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-sunken file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-surface"
          />
          {file ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-faint">
              {kind === 'video' ? <Video className="size-3.5" /> : kind === 'image' ? <ImageIcon className="size-3.5" /> : null}
              {file.name}
              {kind === null ? <span className="text-accent-red">— unsupported file type</span> : null}
            </p>
          ) : null}
        </Field>

        {upload.isPending ? (
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-accent-blue transition-[width] duration-200"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        ) : null}

        {error ? <p className="text-sm text-accent-red">{error}</p> : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-surface-inverse px-4 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {upload.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Uploading…
            </>
          ) : (
            <>
              <Upload className="size-4" /> Upload review
            </>
          )}
        </button>
      </form>
    </Card>
  );
}

function ReviewRow({ review }: { review: StudentReviewView }) {
  const update = useUpdateReview();
  const del = useDeleteReview();

  function onDelete() {
    if (!window.confirm(`Delete review “${review.title}”? This removes the file from storage.`)) return;
    del.mutate(review.id);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-surface ring-1 ring-border-subtle">
      <div className="aspect-video w-full bg-surface-sunken">
        {review.mediaUrl ? (
          review.mediaType === 'video' ? (
            <video controls preload="metadata" className="h-full w-full bg-black object-contain" src={review.mediaUrl} />
          ) : (
            <img src={review.mediaUrl} alt={review.title} className="h-full w-full object-cover" />
          )
        ) : (
          <div className="grid h-full place-items-center text-xs text-ink-faint">Processing…</div>
        )}
      </div>
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{review.title}</div>
          {review.studentName ? <div className="truncate text-xs text-ink-muted">{review.studentName}</div> : null}
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={del.isPending}
          aria-label="Delete review"
          className="shrink-0 rounded-md p-1.5 text-ink-faint transition hover:bg-surface-sunken hover:text-accent-red disabled:opacity-50"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="flex items-center justify-between border-t border-border-subtle px-3 py-2">
        <span className="text-xs text-ink-muted">Visible to students</span>
        <Switch
          checked={review.visible}
          disabled={update.isPending}
          aria-label="Toggle visibility"
          onChange={(next) => update.mutate({ id: review.id, patch: { visible: next } })}
        />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
