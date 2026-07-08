import { useState, type ReactNode } from 'react';
import {
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  StartAudio,
  useLocalParticipant,
  useParticipants,
  useTracks,
} from '@livekit/components-react';
import { Track, VideoPresets, type RoomOptions } from 'livekit-client';
import { Maximize2, Mic, MicOff, Minimize2, Video as VideoIcon, VideoOff } from 'lucide-react';
import { Avatar } from '@mentra/ui';
import '@livekit/components-styles';

/**
 * Publish quality (Phase 0 — explicit simulcast ladder).
 *
 * Broadcast: capture at 1080p and publish a 3-rung simulcast ladder (1080/720/360) so
 * `adaptiveStream` + `dynacast` can hand each viewer the rung their connection supports
 * — no buffering on weak links, full quality on strong ones. Screen-share simulcasts
 * too (LiveKit leaves that off by default). Audio enables DTX (silence suppression) +
 * RED (redundant encoding) for resilience on lossy networks.
 *
 * Note: WebRTC simulcast tops out at 3 spatial layers, so the finer 1080/720/480/360
 * ladder from the spec is produced for *recordings* by the FFmpeg/HLS pipeline (Phase 2),
 * not for the live stream.
 */
const BROADCAST_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  publishDefaults: {
    simulcast: true,
    videoSimulcastLayers: [VideoPresets.h360, VideoPresets.h720],
    screenShareSimulcastLayers: [VideoPresets.h360, VideoPresets.h720],
    red: true,
    dtx: true,
  },
  videoCaptureDefaults: { resolution: VideoPresets.h1080.resolution },
};

/** 1:1 calls don't need a 1080 ladder — capture 720 with a light 2-rung simulcast. */
const CALL_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  publishDefaults: {
    simulcast: true,
    videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
    red: true,
    dtx: true,
  },
  videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
};

/**
 * Live video stage backed by the self-hosted LiveKit SFU. `adaptiveStream` +
 * `dynacast` are on, so each viewer's quality auto up/downgrades to their connection.
 *
 * Only the MENTOR's video is shown in the stage; students are subscribe-only and are
 * listed in a roster below the video (avatar + name), not rendered as video tiles.
 */
export function LiveStage({
  token,
  wsUrl,
  publish,
  publishVideo = true,
  mentorId,
  mentorName,
  placeholderBg,
  overlay,
  onLeft,
  onMuteStudent,
  showRoster = true,
  className,
}: {
  token: string;
  wsUrl: string;
  publish: boolean;
  /**
   * When publishing, also turn the camera on. Mentors broadcast video+audio
   * (default). A promoted student speaks audio-only — pass `false` so we don't
   * force a camera the device may lack/deny, which would fail the whole publish.
   */
  publishVideo?: boolean;
  /** LiveKit identity (= userId) of the mentor whose video fills the stage. */
  mentorId: string;
  mentorName?: string;
  /** Gradient/background shown while the mentor's camera isn't visible yet. */
  placeholderBg?: string;
  /** Rendered over the video (LIVE badge, viewer count, publisher controls). */
  overlay?: ReactNode;
  onLeft?: () => void;
  /**
   * Mentor-only: force-mute a student's mic by identity (= userId). When provided, the
   * roster shows a mute button next to each student who is currently speaking. Omit for
   * the student's own view (no moderation controls).
   */
  onMuteStudent?: (identity: string) => void;
  /**
   * Show the "In the room" participant roster below the video. On by default (mentor view).
   * The student view passes `false` so the live player looks like a plain video (edge-to-edge,
   * no roster strip) — audio still plays via RoomAudioRenderer regardless.
   */
  showRoster?: boolean;
  className?: string;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [deviceErr, setDeviceErr] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);
  return (
    <LiveKitRoom
      serverUrl={wsUrl}
      token={token}
      connect
      video={publish && publishVideo}
      audio={publish}
      options={BROADCAST_OPTIONS}
      onDisconnected={onLeft}
      onError={(e: Error) => setErr(e.message)}
      // Mic/camera acquisition failures are otherwise silent — surface which device
      // failed so the publisher can fix the permission instead of "no audio" mystery.
      onMediaDeviceFailure={(_failure, kind) =>
        setDeviceErr(
          kind === 'audioinput'
            ? 'Microphone is blocked or unavailable — allow mic access in the browser/OS, then rejoin.'
            : kind === 'videoinput'
              ? 'Camera is blocked or unavailable.'
              : 'A media device could not be accessed.',
        )
      }
      data-lk-theme="default"
      // LiveKit's global styles force `.lk-room-container { height: 100% }`, which
      // makes the room wrapper consume the entire (grid-stretched) Card and clip the
      // footer/controls below it. Force auto height so the footer stays in flow.
      className={`!h-auto ${className ?? ''}`}
    >
      <div
        className={
          maximized
            ? 'fixed inset-0 z-[70] bg-black'
            : 'relative aspect-video w-full overflow-hidden'
        }
        style={!maximized && placeholderBg ? { background: placeholderBg } : undefined}
      >
        <MentorStage mentorId={mentorId} mentorName={mentorName} />
        {overlay}
        {/* Browsers block autoplay audio until a user gesture — StartAudio renders a
            prompt ONLY while playback is blocked, then hides itself once allowed. */}
        <StartAudio
          label="🔊 Tap to enable sound"
          className="absolute inset-x-0 bottom-14 z-20 mx-auto w-fit rounded-full bg-black/70 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-black/80"
        />
        <MaximizeButton maximized={maximized} onToggle={() => setMaximized((m) => !m)} />
        {err ? (
          <div className="absolute inset-0 z-20 grid place-items-center bg-black/70 p-4 text-center text-sm text-white">
            <div>
              <div className="font-medium">Couldn’t connect to the live stream</div>
              <div className="mt-1 text-white/70">{err}</div>
            </div>
          </div>
        ) : null}
        {deviceErr ? (
          <div className="absolute inset-x-3 top-12 z-20 mx-auto w-fit rounded-md bg-accent-red/90 px-3 py-1.5 text-center text-xs font-medium text-white shadow ring-1 ring-white/20">
            {deviceErr}
          </div>
        ) : null}
      </div>
      {showRoster ? <ParticipantRoster mentorId={mentorId} onMute={onMuteStudent} /> : null}
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

/** Floating fullscreen toggle. CSS-based (fixed inset-0) so it works on iOS Safari,
 *  where the native Fullscreen API is unsupported for non-<video> elements. */
function MaximizeButton({ maximized, onToggle }: { maximized: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={maximized ? 'Exit fullscreen' : 'Maximize video'}
      title={maximized ? 'Exit fullscreen' : 'Maximize video'}
      className="absolute bottom-3 right-3 z-30 grid size-9 place-items-center rounded-md bg-black/40 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-black/60"
    >
      {maximized ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
    </button>
  );
}

/**
 * Two-way 1:1 call stage: both participants publish camera+mic and every
 * participant's camera renders in a grid. Used for paid 1:1 mentor bookings
 * (group bookings reuse the one-way broadcast `LiveStage` instead).
 */
export function CallStage({
  token,
  wsUrl,
  overlay,
  onLeft,
}: {
  token: string;
  wsUrl: string;
  overlay?: ReactNode;
  onLeft?: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [deviceErr, setDeviceErr] = useState<string | null>(null);
  return (
    <LiveKitRoom
      serverUrl={wsUrl}
      token={token}
      connect
      video
      audio
      options={CALL_OPTIONS}
      onDisconnected={onLeft}
      onError={(e: Error) => setErr(e.message)}
      // A missing/denied camera or mic must NOT silently block the join (common on
      // laptops/desktops without a webcam) — LiveKit still connects subscribe-only,
      // we just surface which device failed instead of looking like a dead join.
      onMediaDeviceFailure={(_failure, kind) =>
        setDeviceErr(
          kind === 'audioinput'
            ? 'Microphone is blocked or unavailable — others can’t hear you. Allow mic access and rejoin.'
            : kind === 'videoinput'
              ? 'Camera is blocked or unavailable — you joined without video.'
              : 'A media device could not be accessed — you joined without it.',
        )
      }
      data-lk-theme="default"
      className="!h-auto"
    >
      <CallGrid err={err} deviceErr={deviceErr} />
      {overlay}
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function CallGrid({ err, deviceErr }: { err?: string | null; deviceErr?: string | null }) {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], { onlySubscribed: false });
  const [maximized, setMaximized] = useState(false);
  return (
    <div className={maximized ? 'fixed inset-0 z-[70] bg-black' : 'relative aspect-video w-full overflow-hidden bg-black'}>
      <GridLayout tracks={tracks} style={{ height: '100%' }}>
        <ParticipantTile />
      </GridLayout>
      <StartAudio
        label="🔊 Tap to enable sound"
        className="absolute inset-x-0 bottom-14 z-20 mx-auto w-fit rounded-full bg-black/70 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-black/80"
      />
      <MaximizeButton maximized={maximized} onToggle={() => setMaximized((m) => !m)} />
      {deviceErr ? (
        <div className="absolute inset-x-3 top-3 z-20 mx-auto w-fit rounded-md bg-accent-red/90 px-3 py-1.5 text-center text-xs font-medium text-white shadow ring-1 ring-white/20">
          {deviceErr}
        </div>
      ) : null}
      {err ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/70 p-4 text-center text-sm text-white">
          <div>
            <div className="font-medium">Couldn’t connect to the call</div>
            <div className="mt-1 text-white/70">{err}</div>
          </div>
        </div>
      ) : null}
      <MediaControls />
    </div>
  );
}

/** Renders only the mentor's camera/screenshare; a placeholder until video arrives. */
function MentorStage({ mentorId, mentorName }: { mentorId: string; mentorName?: string }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  ).filter((t) => t.participant.identity === mentorId);

  if (tracks.length === 0) {
    return (
      <div className="grid h-full place-items-center">
        <div className="flex flex-col items-center gap-3 text-white/80">
          <Avatar name={mentorName ?? 'Mentor'} size="2xl" />
          <div className="text-sm">Waiting for {mentorName ?? 'the mentor'}’s video…</div>
        </div>
      </div>
    );
  }
  return (
    <GridLayout tracks={tracks} style={{ height: '100%' }}>
      <ParticipantTile />
    </GridLayout>
  );
}

/** Students currently in the room, shown as avatar + name (no video tiles). When `onMute`
 *  is provided (mentor view), each currently-speaking student gets a mute button. */
function ParticipantRoster({ mentorId, onMute }: { mentorId: string; onMute?: (identity: string) => void }) {
  const participants = useParticipants();
  const students = participants.filter((p) => p.identity !== mentorId);

  return (
    <div className="border-t border-border-subtle px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-ink-faint">
        <span className="font-medium uppercase tracking-wide">In the room</span>
        <span>{students.length}</span>
      </div>
      {students.length === 0 ? (
        <div className="text-xs text-ink-faint">No students have joined yet.</div>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-2.5">
          {students.map((p) => (
            <div key={p.identity} className="flex items-center gap-2">
              <Avatar name={p.name || 'Student'} size="sm" online={p.isMicrophoneEnabled} />
              <span className="text-sm text-ink">{p.name || 'Student'}</span>
              {onMute && p.isMicrophoneEnabled ? (
                <button
                  type="button"
                  onClick={() => onMute(p.identity)}
                  title={`Mute ${p.name || 'student'}`}
                  aria-label={`Mute ${p.name || 'student'}`}
                  className="grid size-6 place-items-center rounded-md text-ink-faint ring-1 ring-border-subtle transition hover:text-accent-red hover:ring-border-strong"
                >
                  <MicOff className="size-3.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Themed mic/camera toggles for a publisher. Must render inside <LiveStage overlay>.
 * `camera` defaults to true (mentor broadcasts video); pass `camera={false}` for
 * promoted students, who speak (mic) but don't share video.
 */
export function MediaControls({ camera = true }: { camera?: boolean }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  return (
    <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
      <Toggle
        on={isMicrophoneEnabled}
        onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        onIcon={<Mic className="size-4" />}
        offIcon={<MicOff className="size-4" />}
        label={isMicrophoneEnabled ? 'Mute mic' : 'Unmute mic'}
      />
      {camera ? (
        <Toggle
          on={isCameraEnabled}
          onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
          onIcon={<VideoIcon className="size-4" />}
          offIcon={<VideoOff className="size-4" />}
          label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
        />
      ) : null}
    </div>
  );
}

function Toggle({
  on,
  onClick,
  onIcon,
  offIcon,
  label,
}: {
  on: boolean;
  onClick: () => void;
  onIcon: ReactNode;
  offIcon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid size-10 place-items-center rounded-md ring-1 backdrop-blur transition ${
        on
          ? 'bg-black/40 text-white ring-white/20 hover:bg-black/60'
          : 'bg-accent-red/80 text-white ring-accent-red/40 hover:brightness-110'
      }`}
    >
      {on ? onIcon : offIcon}
    </button>
  );
}
