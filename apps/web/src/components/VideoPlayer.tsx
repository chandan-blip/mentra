import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

/**
 * HLS video-on-demand player for session recordings.
 *
 * Uses hls.js where supported (adaptive bitrate, chunked .ts loading, quality auto-switch)
 * and falls back to the browser's native HLS on Safari/iOS. `startAt` seeks to a saved
 * position on load (resume-watching) and `onProgress` reports playback time periodically
 * so the caller can persist it — keeping the DB/localStorage decision out of the player.
 */
export function VideoPlayer({
  src,
  poster,
  startAt = 0,
  onProgress,
  className,
}: {
  /** HLS master playlist URL (…/master.m3u8). */
  src: string;
  poster?: string;
  /** Seconds to resume from on load. */
  startAt?: number;
  /** Called ~every 5s with the current playback time (seconds). */
  onProgress?: (seconds: number) => void;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);

    let hls: Hls | null = null;

    // Seek to the resume point once metadata is ready (works for both paths).
    const seekToStart = () => {
      if (startAt > 0 && Number.isFinite(startAt) && startAt < (video.duration || Infinity)) {
        video.currentTime = startAt;
      }
    };

    if (Hls.isSupported()) {
      hls = new Hls({
        // Keep a small forward buffer so we prefetch the next segments without hoarding.
        maxBufferLength: 30,
        // Start at a mid rung, then let ABR climb — avoids a slow first segment.
        startLevel: -1,
        enableWorker: true,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, seekToStart);
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          // Try to recover from transient network/media errors before giving up.
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls?.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls?.recoverMediaError();
          else setError('This recording could not be played.');
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari/iOS).
      video.src = src;
      video.addEventListener('loadedmetadata', seekToStart, { once: true });
    } else {
      setError('Your browser does not support HLS playback.');
    }

    // Throttled progress reporting for resume-watching.
    let lastReport = 0;
    const onTimeUpdate = () => {
      const now = video.currentTime;
      if (onProgress && now - lastReport >= 5) {
        lastReport = now;
        onProgress(Math.floor(now));
      }
    };
    video.addEventListener('timeupdate', onTimeUpdate);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      hls?.destroy();
    };
    // Re-init only when the source changes; startAt is read live inside seekToStart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-lg bg-black ${className ?? ''}`}>
      <video
        ref={videoRef}
        poster={poster}
        controls
        playsInline
        className="h-full w-full"
      />
      {error ? (
        <div className="absolute inset-0 grid place-items-center bg-black/70 p-4 text-center text-sm text-white">
          {error}
        </div>
      ) : null}
    </div>
  );
}
