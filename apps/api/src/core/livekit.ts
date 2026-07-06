import {
  AccessToken,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  RoomServiceClient,
  S3Upload,
  WebhookReceiver,
  type VideoGrant,
} from 'livekit-server-sdk';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { r2Enabled } from './r2.js';

/**
 * Thin wrapper around the self-hosted LiveKit SFU. Mentra never touches raw media —
 * it only mints room-join tokens (adaptive simulcast/dynacast is handled by LiveKit
 * itself, so quality up/downgrades to the viewer's connection automatically), manages
 * room lifecycle, and verifies inbound webhooks.
 *
 * Recording: `startEgress`/`stopEgress` (bottom) drive a LiveKit room-composite egress
 * that writes a single MP4 to Cloudflare R2. The FFmpeg worker then transcodes it into
 * the HLS ABR ladder. Gated on `r2Enabled()` — with no R2 creds the feature stays off.
 * NOTE: this needs the LiveKit **Egress service** deployed alongside the SFU + Redis.
 */

const roomService = new RoomServiceClient(
  env.LIVEKIT_URL,
  env.LIVEKIT_API_KEY,
  env.LIVEKIT_API_SECRET,
);

const webhookReceiver = new WebhookReceiver(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);

export type MintTokenInput = {
  room: string;
  /** Stable participant identity — we use the Mentra userId. */
  identity: string;
  /** Display name shown to other participants. */
  name: string;
  /** Mentors/owners (and promoted students) publish; plain viewers subscribe only. */
  canPublish: boolean;
};

/** Mint a LiveKit access token for a participant to join a room. */
export async function mintToken(input: MintTokenInput): Promise<string> {
  const grant: VideoGrant = {
    roomJoin: true,
    room: input.room,
    canPublish: input.canPublish,
    canSubscribe: true,
    // Allow the data channel for low-level signalling; chat is on Socket.IO so it
    // can be persisted server-side, not here.
    canPublishData: true,
  };

  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: input.identity,
    name: input.name,
    ttl: env.LIVEKIT_TOKEN_TTL_SECONDS,
  });
  at.addGrant(grant);
  return at.toJwt();
}

/** Idempotently ensure a room exists (LiveKit no-ops if it already does). */
export async function ensureRoom(name: string): Promise<void> {
  try {
    await roomService.createRoom({ name, emptyTimeout: 5 * 60, maxParticipants: 0 });
  } catch (err) {
    // createRoom on an existing room can throw — treat as benign.
    logger.debug({ err, room: name }, 'ensureRoom (likely already exists)');
  }
}

/** Tear down a room (kicks any stragglers, fires the room_finished webhook). */
export async function endRoom(name: string): Promise<void> {
  try {
    await roomService.deleteRoom(name);
  } catch (err) {
    logger.warn({ err, room: name }, 'endRoom failed (room may already be gone)');
  }
}

/**
 * Verify + decode an inbound LiveKit webhook. Throws if the HMAC signature in the
 * Authorization header doesn't match our API secret.
 */
export async function receiveWebhook(rawBody: string, authHeader: string | undefined) {
  return webhookReceiver.receive(rawBody, authHeader);
}

// --- Recording (room-composite egress → R2) ------------------------------------

const egressClient = new EgressClient(env.LIVEKIT_URL, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);

/** True when recording can run (R2 configured). Callers gate start/stop on this. */
export function egressEnabled(): boolean {
  return r2Enabled();
}

/** R2 key for a session's raw composite recording — the worker transcodes this to HLS. */
export function rawRecordingKey(sessionId: string): string {
  return `recordings/${sessionId}/source.mp4`;
}

/** R2 destination as a LiveKit S3Upload (R2 is S3-compatible; needs path-style). */
function r2Upload(): S3Upload {
  return new S3Upload({
    accessKey: env.R2_ACCESS_KEY_ID,
    secret: env.R2_SECRET_ACCESS_KEY,
    region: env.R2_REGION || 'auto',
    endpoint: env.R2_ENDPOINT,
    bucket: env.R2_BUCKET,
    forcePathStyle: true,
  });
}

/**
 * Start a room-composite egress recording the whole session to one MP4 in R2.
 * Returns the LiveKit egressId (persist on `LiveSession.egressId`). 'speaker' layout
 * keeps the active speaker full-frame — right for a lecture broadcast.
 */
export async function startEgress(room: string, sessionId: string): Promise<string> {
  const output = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: rawRecordingKey(sessionId),
    // We track recording state in our own DB, so skip LiveKit's sidecar .json manifest.
    disableManifest: true,
    output: { case: 's3', value: r2Upload() },
  });
  const info = await egressClient.startRoomCompositeEgress(room, output, { layout: 'speaker' });
  return info.egressId;
}

/** Stop a running egress (on session end). Tolerates an already-stopped egress. */
export async function stopEgress(egressId: string): Promise<void> {
  try {
    await egressClient.stopEgress(egressId);
  } catch (err) {
    logger.warn({ err, egressId }, 'stopEgress failed (may have already finished)');
  }
}
