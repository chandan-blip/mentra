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
import { Track } from 'livekit-client';
import { Mic, MicOff, Video as VideoIcon, VideoOff } from 'lucide-react';
import { Avatar } from '@mentra/ui';
import '@livekit/components-styles';

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
  mentorId,
  mentorName,
  placeholderBg,
  overlay,
  onLeft,
  className,
}: {
  token: string;
  wsUrl: string;
  publish: boolean;
  /** LiveKit identity (= userId) of the mentor whose video fills the stage. */
  mentorId: string;
  mentorName?: string;
  /** Gradient/background shown while the mentor's camera isn't visible yet. */
  placeholderBg?: string;
  /** Rendered over the video (LIVE badge, viewer count, publisher controls). */
  overlay?: ReactNode;
  onLeft?: () => void;
  className?: string;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [deviceErr, setDeviceErr] = useState<string | null>(null);
  return (
    <LiveKitRoom
      serverUrl={wsUrl}
      token={token}
      connect
      video={publish}
      audio={publish}
      options={{ adaptiveStream: true, dynacast: true }}
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
      <div className="relative aspect-video w-full overflow-hidden" style={placeholderBg ? { background: placeholderBg } : undefined}>
        <MentorStage mentorId={mentorId} mentorName={mentorName} />
        {overlay}
        {/* Browsers block autoplay audio until a user gesture — StartAudio renders a
            prompt ONLY while playback is blocked, then hides itself once allowed. */}
        <StartAudio
          label="🔊 Tap to enable sound"
          className="absolute inset-x-0 bottom-14 z-20 mx-auto w-fit rounded-full bg-black/70 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-black/80"
        />
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
      <ParticipantRoster mentorId={mentorId} />
      <RoomAudioRenderer />
    </LiveKitRoom>
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
  return (
    <LiveKitRoom
      serverUrl={wsUrl}
      token={token}
      connect
      video
      audio
      options={{ adaptiveStream: true, dynacast: true }}
      onDisconnected={onLeft}
      data-lk-theme="default"
      className="!h-auto"
    >
      <CallGrid />
      {overlay}
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function CallGrid() {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], { onlySubscribed: false });
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
      <GridLayout tracks={tracks} style={{ height: '100%' }}>
        <ParticipantTile />
      </GridLayout>
      <StartAudio
        label="🔊 Tap to enable sound"
        className="absolute inset-x-0 bottom-14 z-20 mx-auto w-fit rounded-full bg-black/70 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-black/80"
      />
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

/** Students currently in the room, shown as avatar + name (no video tiles). */
function ParticipantRoster({ mentorId }: { mentorId: string }) {
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
