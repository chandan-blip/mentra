import {
  AccessToken,
  RoomServiceClient,
  WebhookReceiver,
  type VideoGrant,
} from 'livekit-server-sdk';
import { env } from '../env.js';
import { logger } from '../logger.js';

/**
 * Thin wrapper around the self-hosted LiveKit SFU. Mentra never touches raw media —
 * it only mints room-join tokens (adaptive simulcast/dynacast is handled by LiveKit
 * itself, so quality up/downgrades to the viewer's connection automatically), manages
 * room lifecycle, and verifies inbound webhooks.
 *
 * Recording (LiveKit egress to object storage) is a LATER phase — see `startEgress`
 * stub at the bottom. We deliberately don't implement it yet.
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

// --- Recording seam (LATER) ----------------------------------------------------
// When we ship A/V file recording, add an EgressClient here and start/stop room
// composite egress on session start/end, writing to object storage and filling
// LiveSession.recordingStatus / recordingUrl / egressId. Intentionally unimplemented.
//
// import { EgressClient } from 'livekit-server-sdk';
// export async function startEgress(room: string): Promise<string> { /* ... */ }
// export async function stopEgress(egressId: string): Promise<void> { /* ... */ }
