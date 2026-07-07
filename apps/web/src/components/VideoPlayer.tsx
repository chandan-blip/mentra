import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import Hls from 'hls.js';
import {
  Check,
  Gauge,
  Maximize,
  Minimize,
  Pause,
  Play,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react';

/**
 * HLS video-on-demand player for session recordings, with a custom YouTube-style
 * control bar (play/pause, scrubbable seek bar, quality + speed menu, fullscreen).
 *
 * Uses hls.js where supported (adaptive bitrate, chunked .ts loading, manual quality
 * pinning) and falls back to the browser's native HLS on Safari/iOS. `startAt` seeks to
 * a saved position on load (resume-watching); `onProgress` reports playback time
 * periodically so the caller can persist it.
 *
 * Fullscreen (the expand button) requests fullscreen on the wrapper and — on phones —
 * tries to lock the screen to landscape; on exit it unlocks. Where orientation lock is
 * unsupported (iOS Safari), fullscreen still works and simply follows the device's own
 * rotation.
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [rate, setRate] = useState(1);
  const [levels, setLevels] = useState<{ index: number; height: number }[]>([]);
  const [quality, setQuality] = useState(-1); // -1 = auto
  const [autoHeight, setAutoHeight] = useState<number | null>(null);
  const [menu, setMenu] = useState<'none' | 'quality' | 'speed'>('none');
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsShown, setControlsShown] = useState(true);

  // --- Source setup (hls.js / native) ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setReady(false);

    let hls: Hls | null = null;
    const seekToStart = () => {
      if (startAt > 0 && Number.isFinite(startAt) && startAt < (video.duration || Infinity)) {
        video.currentTime = startAt;
      }
      setReady(true);
      // Autoplay for an instant start. Try with sound; if the browser's autoplay policy
      // blocks it, retry muted so it still plays (the user can unmute from the controls).
      video.play().catch(() => {
        video.muted = true;
        void video.play().catch(() => {});
      });
    };

    if (Hls.isSupported()) {
      // startLevel is set to the lowest rendition in MANIFEST_PARSED for a near-instant
      // first frame; hls.js's ABR then climbs to the best level the connection sustains.
      // A low initial bandwidth estimate keeps the very first segment small.
      hls = new Hls({
        maxBufferLength: 30,
        enableWorker: true,
        abrEwmaDefaultEstimate: 500_000,
        startFragPrefetch: true, // fetch the first segment while the level playlist loads
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Newest→largest first so the menu reads 1080p → 360p top to bottom.
        const ls = hls!.levels
          .map((l, index) => ({ index, height: l.height }))
          .sort((a, b) => b.height - a.height);
        setLevels(ls);
        // Start on the lowest-bitrate rendition (manifest order isn't guaranteed, so pick
        // it explicitly); ABR takes over from the second segment onward.
        const lowest = hls!.levels.reduce((min, l, i, arr) => (l.bitrate < arr[min]!.bitrate ? i : min), 0);
        hls!.startLevel = lowest;
        seekToStart();
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        setAutoHeight(hls!.levels[data.level]?.height ?? null);
      });
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls?.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls?.recoverMediaError();
        else setError('This recording could not be played.');
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadedmetadata', seekToStart, { once: true });
    } else {
      setError('Your browser does not support HLS playback.');
    }

    return () => {
      hls?.destroy();
      hlsRef.current = null;
    };
    // Re-init only when the source changes; startAt is read live inside seekToStart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // --- Media element events → state + throttled progress ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let lastReport = 0;

    const onTime = () => {
      const now = video.currentTime;
      setCurrent(now);
      if (video.buffered.length) setBuffered(video.buffered.end(video.buffered.length - 1));
      if (onProgress && now - lastReport >= 5) {
        lastReport = now;
        onProgress(Math.floor(now));
      }
    };
    const onMeta = () => setDuration(video.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onVol = () => setMuted(video.muted);
    const onRate = () => setRate(video.playbackRate);

    video.addEventListener('timeupdate', onTime);
    video.addEventListener('progress', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('durationchange', onMeta);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('volumechange', onVol);
    video.addEventListener('ratechange', onRate);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('progress', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('durationchange', onMeta);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('volumechange', onVol);
      video.removeEventListener('ratechange', onRate);
    };
  }, [onProgress]);

  // --- Fullscreen tracking (+ unlock orientation on exit) ---
  useEffect(() => {
    const sync = () => {
      const fs = Boolean(document.fullscreenElement || (document as { webkitFullscreenElement?: Element | null }).webkitFullscreenElement);
      setFullscreen(fs);
      if (!fs) {
        try {
          (screen.orientation as unknown as { unlock?: () => void })?.unlock?.();
        } catch {
          /* not supported */
        }
      }
    };
    const onIosBegin = () => setFullscreen(true);
    const onIosEnd = () => setFullscreen(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dAny = document as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vAny = videoRef.current as any;
    dAny.addEventListener('fullscreenchange', sync);
    dAny.addEventListener('webkitfullscreenchange', sync);
    // iOS fires these on the <video> element for native fullscreen.
    vAny?.addEventListener('webkitbeginfullscreen', onIosBegin);
    vAny?.addEventListener('webkitendfullscreen', onIosEnd);
    return () => {
      dAny.removeEventListener('fullscreenchange', sync);
      dAny.removeEventListener('webkitfullscreenchange', sync);
      vAny?.removeEventListener('webkitbeginfullscreen', onIosBegin);
      vAny?.removeEventListener('webkitendfullscreen', onIosEnd);
    };
  }, []);

  // --- Auto-hide the control bar while playing ---
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wake = useCallback(() => {
    setControlsShown(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsShown(false), 2600);
  }, []);
  useEffect(() => {
    if (!playing) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setControlsShown(true);
    } else {
      wake();
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [playing, wake]);

  // --- Actions ---
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };
  const seek = (seconds: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.min(duration || Infinity, Math.max(0, seconds));
  };
  const toggleMute = () => {
    const v = videoRef.current;
    if (v) v.muted = !v.muted;
  };
  const pickQuality = (index: number) => {
    const hls = hlsRef.current;
    if (hls) hls.currentLevel = index; // -1 = auto
    setQuality(index);
    setMenu('none');
  };
  const pickSpeed = (r: number) => {
    const v = videoRef.current;
    if (v) v.playbackRate = r;
    setMenu('none');
  };
  const toggleFullscreen = async () => {
    const el = wrapRef.current as (HTMLElement & { webkitRequestFullscreen?: () => void }) | null;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => void;
    };
    const inFs = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);

    if (!inFs) {
      try {
        if (el?.requestFullscreen) await el.requestFullscreen();
        else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen();
        // iOS Safari can't fullscreen a <div> — only the <video> element itself.
        else video?.webkitEnterFullscreen?.();
      } catch {
        video?.webkitEnterFullscreen?.();
      }
      try {
        await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.('landscape');
      } catch {
        /* orientation lock unsupported (e.g. iOS) — physical rotation still works */
      }
    } else {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else doc.webkitExitFullscreen?.();
      } catch {
        /* ignore */
      }
      try {
        (screen.orientation as unknown as { unlock?: () => void })?.unlock?.();
      } catch {
        /* ignore */
      }
    }
  };

  const activeQualityLabel =
    quality === -1 ? `Auto${autoHeight ? ` · ${autoHeight}p` : ''}` : `${levels.find((l) => l.index === quality)?.height ?? ''}p`;

  return (
    <div
      ref={wrapRef}
      className={`group relative w-full max-w-full select-none overflow-hidden bg-black ${
        fullscreen ? 'flex h-full items-center justify-center' : 'aspect-video rounded-lg'
      } ${!controlsShown && playing ? 'cursor-none' : ''} ${className ?? ''}`}
      onPointerMove={wake}
      onPointerLeave={() => playing && setControlsShown(false)}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        onClick={togglePlay}
        className={fullscreen ? 'max-h-full max-w-full object-contain' : 'h-full w-full object-contain'}
      />

      {/* Center play/pause tap target when idle/paused */}
      {ready && !error && (!playing || controlsShown) ? (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          className={`absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition ${
            playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
          }`}
        >
          {playing ? <Pause className="size-7" /> : <Play className="size-7 translate-x-0.5" />}
        </button>
      ) : null}

      {/* Loading spinner before first frame */}
      {!ready && !error ? (
        <div className="absolute inset-0 grid place-items-center">
          <span className="size-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      ) : null}

      {/* Control bar */}
      {!error ? (
        <div
          className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-3 pb-2 pt-8 transition-opacity ${
            controlsShown || !playing ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <Seekbar videoRef={videoRef} duration={duration} buffered={buffered} onSeek={seek} />
          <div className="mt-1 flex items-center gap-3 text-white">
            <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} className="flex items-center transition hover:text-white/80">
              {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
            </button>
            <button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} className="flex items-center transition hover:text-white/80">
              {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
            <span className="text-xs tabular-nums text-white/90">
              {fmt(current)} <span className="text-white/50">/ {fmt(duration)}</span>
            </span>

            <div className="ml-auto flex items-center gap-3">
              {/* Settings (quality + speed) */}
              <div className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => setMenu((m) => (m === 'none' ? 'quality' : 'none'))}
                  aria-label="Playback settings"
                  className="flex items-center transition hover:text-white/80"
                >
                  <Settings className={`size-5 transition ${menu !== 'none' ? 'rotate-90' : ''}`} />
                </button>
                {menu !== 'none' ? (
                  <div className="absolute bottom-9 right-0 w-44 overflow-hidden rounded-xl bg-black/90 text-sm text-white shadow-xl ring-1 ring-white/10 backdrop-blur">
                    <div className="flex border-b border-white/10 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setMenu('quality')}
                        className={`flex-1 px-3 py-2 ${menu === 'quality' ? 'bg-white/10' : ''}`}
                      >
                        Quality
                      </button>
                      <button
                        type="button"
                        onClick={() => setMenu('speed')}
                        className={`flex-1 px-3 py-2 ${menu === 'speed' ? 'bg-white/10' : ''}`}
                      >
                        Speed
                      </button>
                    </div>
                    {menu === 'quality' ? (
                      levels.length ? (
                        <ul className="max-h-56 overflow-y-auto py-1">
                          <MenuRow label="Auto" active={quality === -1} onClick={() => pickQuality(-1)} />
                          {levels.map((l) => (
                            <MenuRow
                              key={l.index}
                              label={`${l.height}p`}
                              active={quality === l.index}
                              onClick={() => pickQuality(l.index)}
                            />
                          ))}
                        </ul>
                      ) : (
                        <div className="px-3 py-3 text-xs text-white/60">Adaptive (auto)</div>
                      )
                    ) : (
                      <ul className="py-1">
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                          <MenuRow
                            key={r}
                            label={r === 1 ? 'Normal' : `${r}×`}
                            active={rate === r}
                            onClick={() => pickSpeed(r)}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Speed shortcut chip (shows current rate) */}
              {rate !== 1 ? (
                <button
                  type="button"
                  onClick={() => setMenu('speed')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-white/90"
                  aria-label="Playback speed"
                >
                  <Gauge className="size-4" /> {rate}×
                </button>
              ) : null}

              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={fullscreen ? 'Exit fullscreen' : 'Expand'}
                className="flex items-center transition hover:text-white/80"
              >
                {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
              </button>
            </div>
          </div>
          {quality !== -1 || rate !== 1 ? (
            <div className="pointer-events-none mt-1 text-[10px] text-white/50">
              {activeQualityLabel}
              {rate !== 1 ? ` · ${rate}×` : ''}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-0 grid place-items-center bg-black/70 p-4 text-center text-sm text-white">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function MenuRow({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-white/10 ${
          active ? 'text-white' : 'text-white/75'
        }`}
      >
        <Check className={`size-3.5 ${active ? 'opacity-100' : 'opacity-0'}`} />
        {label}
      </button>
    </li>
  );
}

/** Scrubbable seek bar with a buffered track, played fill, and a draggable thumb. */
function Seekbar({
  videoRef,
  duration,
  buffered,
  onSeek,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  duration: number;
  buffered: number;
  onSeek: (seconds: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  // While scrubbing, render from the pointer position (0–1) so the thumb tracks the
  // finger 1:1 instead of waiting for the video's coarse `timeupdate` to catch up.
  const [dragPct, setDragPct] = useState<number | null>(null);
  // rAF-driven playhead so the fill glides at ~60fps during playback rather than
  // stepping on each timeupdate (~4×/s). setState bails when the time is unchanged
  // (e.g. paused), so idle frames don't re-render.
  const [head, setHead] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) setHead((prev) => (prev === v.currentTime ? prev : v.currentTime));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [videoRef]);

  const fraction = dragPct ?? (duration ? Math.min(1, Math.max(0, head / duration)) : 0);
  const played = fraction * 100;
  const buf = duration ? Math.min(100, (buffered / duration) * 100) : 0;

  const seekAt = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || !duration) return 0;
      const rect = track.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onSeek(pct * duration);
      return pct;
    },
    [duration, onSeek],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragPct(seekAt(e.clientX));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragPct === null && e.buttons !== 1 && e.pressure === 0) return;
    setDragPct(seekAt(e.clientX));
  };
  const endDrag = () => setDragPct(null);

  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="group/sb relative flex h-3.5 cursor-pointer touch-none items-center"
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.floor(duration)}
      aria-valuenow={Math.floor(fraction * duration)}
      tabIndex={0}
    >
      <div className="relative h-[3px] w-full rounded-full bg-white/25 transition-[height] group-hover/sb:h-[5px]">
        <div className="absolute inset-y-0 left-0 rounded-full bg-white/40" style={{ width: `${buf}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent-red" style={{ width: `${played}%` }} />
      </div>
      <div
        className={`absolute size-3 -translate-x-1/2 rounded-full bg-accent-red shadow transition-opacity ${
          dragPct !== null ? 'opacity-100' : 'opacity-0 group-hover/sb:opacity-100'
        }`}
        style={{ left: `${played}%` }}
      />
    </div>
  );
}

/** mm:ss (or h:mm:ss) time label. */
function fmt(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return h > 0 ? `${h}:${mm}:${String(sec).padStart(2, '0')}` : `${mm}:${String(sec).padStart(2, '0')}`;
}
