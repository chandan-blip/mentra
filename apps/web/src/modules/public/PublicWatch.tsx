import { Link, useParams } from 'react-router-dom';
import type { LiveSessionView } from '@mentra/shared';
import { Avatar } from '@mentra/ui';
import { VideoPlayer } from '../../components/VideoPlayer.js';
import { usePublicVideo } from '../../lib/videos.js';
import { resolveAvatarUrl } from '../../lib/auth.js';

/** Poster fallback derived from the HLS master URL (same convention as the cards). */
function posterOf(v: LiveSessionView): string | undefined {
  if (v.thumbnailUrl) return v.thumbnailUrl;
  return v.recordingUrl ? v.recordingUrl.replace(/\/hls\/master\.m3u8$/, '/thumb.jpg') : undefined;
}

/**
 * Public, no-auth watch page (`/watch/:id`) for a video a manager marked public. Anyone
 * with the link can watch — no login. The API only returns public, ready recordings, so
 * private/processing videos 404 here.
 */
export function PublicWatchPage() {
  const { id } = useParams();
  const video = usePublicVideo(id ?? null);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="text-lg font-extrabold tracking-tight text-ink">
          Mentra<span className="text-accent-red">.</span>
        </Link>
        <Link
          to="/auth"
          className="rounded-full bg-surface-inverse px-4 py-1.5 text-sm font-semibold text-ink-inverse transition hover:bg-ink"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6">
        {video.isLoading ? (
          <div className="aspect-video w-full animate-pulse rounded-lg bg-surface-sunken" />
        ) : video.isError || !video.data ? (
          <div className="mt-10 rounded-lg bg-surface-sunken p-10 text-center">
            <div className="text-base font-semibold text-ink">This video isn’t available</div>
            <p className="mt-1 text-sm text-ink-faint">
              It may be private or removed. Ask whoever shared it for access.
            </p>
            <Link
              to="/"
              className="mt-4 inline-block rounded-full bg-surface-inverse px-4 py-2 text-sm font-semibold text-ink-inverse transition hover:bg-ink"
            >
              Go to Mentra
            </Link>
          </div>
        ) : (
          <PublicVideo video={video.data} />
        )}
      </main>
    </div>
  );
}

function PublicVideo({ video: v }: { video: LiveSessionView }) {
  return (
    <>
      <div className="-mx-4 overflow-hidden bg-black sm:mx-0 sm:rounded-lg">
        {v.recordingUrl ? (
          <VideoPlayer src={v.recordingUrl} poster={posterOf(v)} />
        ) : (
          <div className="grid aspect-video place-items-center text-sm text-white/70">Recording unavailable</div>
        )}
      </div>

      <h1 className="mt-4 text-lg font-semibold leading-snug text-ink sm:text-xl">{v.title}</h1>
      <div className="mt-2 flex items-center gap-3">
        <Avatar size="sm" src={resolveAvatarUrl(v.mentorAvatarUrl)} name={v.mentorName} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{v.mentorName}</div>
          <div className="truncate text-xs text-ink-faint">{v.topic}</div>
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-surface-sunken p-4 text-center text-sm text-ink-muted">
        Want the full experience — roadmaps, live sessions and more?{' '}
        <Link to="/auth" className="font-semibold text-ink underline">
          Sign in to Mentra
        </Link>
      </div>
    </>
  );
}
