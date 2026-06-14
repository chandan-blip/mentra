import jwt from 'jsonwebtoken';
import type {
  ConnectChannelInput,
  CreateMarketingPostInput,
  LinkedInAuthUrlResponse,
  MarketingChannel,
  MarketingConnectionView,
  MarketingPostView,
} from '@mentra/shared';
import { env } from '../../env.js';
import {
  authorizeUrl,
  createMemberPost,
  exchangeCode,
  fetchSocialActions,
  fetchUserinfo,
  LinkedInError,
  linkedinConfigured,
  postUrl as linkedinPostUrl,
} from '../../core/linkedin.js';
import { MarketingError } from './marketing.errors.js';
import * as repo from './marketing.repository.js';

/** Marketing channel connections + posting. Gated to the marketing role at the route layer. */

export const MARKETING_ROLE = 'marketing';

function toView(row: repo.ConnectionRow): MarketingConnectionView {
  return {
    channel: row.channel as MarketingChannel,
    handle: row.handle,
    displayName: row.displayName,
    connectedAt: row.connectedAt.toISOString(),
    connectedVia: row.providerId ? 'oauth' : 'manual',
  };
}

// --- LinkedIn OAuth ---

/** Sign a short-lived state token tying the OAuth round-trip to the initiating user. */
function signOAuthState(userId: string): string {
  return jwt.sign({ sub: userId, kind: 'li_oauth' }, env.JWT_ACCESS_SECRET, { expiresIn: '10m' });
}

function verifyOAuthState(state: string): string {
  let decoded: { sub?: string; kind?: string };
  try {
    decoded = jwt.verify(state, env.JWT_ACCESS_SECRET) as { sub?: string; kind?: string };
  } catch {
    throw new MarketingError('OAUTH_STATE', 'OAuth state expired or invalid', 400);
  }
  if (decoded.kind !== 'li_oauth' || !decoded.sub) throw new MarketingError('OAUTH_STATE', 'Invalid OAuth state', 400);
  return decoded.sub;
}

export async function getLinkedInAuthUrl(userId: string): Promise<LinkedInAuthUrlResponse> {
  if (!linkedinConfigured()) throw new MarketingError('NOT_CONFIGURED', 'LinkedIn isn’t configured yet', 503);
  return { url: authorizeUrl(signOAuthState(userId)) };
}

export async function handleLinkedInCallback(code: string, state: string): Promise<void> {
  const userId = verifyOAuthState(state);
  const token = await exchangeCode(code);
  const profile = await fetchUserinfo(token.accessToken);
  const tokenExpiresAt = token.expiresInSec > 0 ? new Date(Date.now() + token.expiresInSec * 1000) : null;
  await repo.upsertConnection({
    userId,
    channel: 'linkedin',
    handle: profile.name,
    displayName: profile.name,
    providerId: profile.sub,
    accessToken: token.accessToken,
    tokenExpiresAt,
    scope: token.scope,
  });
}

export async function syncLinkedInStats(userId: string): Promise<MarketingPostView[]> {
  const connection = await repo.findConnection(userId, 'linkedin');
  if (!connection?.accessToken) throw new MarketingError('CONNECT_REQUIRED', 'Connect your LinkedIn account first', 409);
  const posts = await repo.listPosts(userId, 'linkedin');
  for (const p of posts) {
    if (!p.providerPostUrn) continue;
    const { likes, comments } = await fetchSocialActions(connection.accessToken, p.providerPostUrn);
    await repo.updatePostStats(p.id, likes, comments);
  }
  return listPosts(userId, 'linkedin');
}

export async function listConnections(userId: string): Promise<MarketingConnectionView[]> {
  return (await repo.listConnections(userId)).map(toView);
}

export async function connectChannel(userId: string, input: ConnectChannelInput): Promise<MarketingConnectionView[]> {
  await repo.upsertConnection({
    userId,
    channel: input.channel,
    handle: input.handle,
    displayName: input.displayName ?? null,
  });
  return listConnections(userId);
}

export async function disconnectChannel(userId: string, channel: string): Promise<MarketingConnectionView[]> {
  await repo.deleteConnection(userId, channel);
  return listConnections(userId);
}

// --- Posts ---

const randInt = (min: number, max: number): number => min + Math.floor(Math.random() * (max - min + 1));

function toPostView(row: repo.PostRow): MarketingPostView {
  const engagementRate = row.impressions > 0
    ? Math.round(((row.likes + row.comments + row.shares) / row.impressions) * 1000) / 10
    : 0;
  return {
    id: row.id,
    channel: row.channel as MarketingChannel,
    body: row.body,
    mediaUrl: row.mediaUrl,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    impressions: row.impressions,
    engagementRate,
    postUrl: row.providerPostUrn ? linkedinPostUrl(row.providerPostUrn) : null,
    postedAt: row.postedAt.toISOString(),
  };
}

export async function listPosts(userId: string, channel: string): Promise<MarketingPostView[]> {
  return (await repo.listPosts(userId, channel)).map(toPostView);
}

export async function createPost(userId: string, input: CreateMarketingPostInput): Promise<MarketingPostView> {
  const connection = await repo.findConnection(userId, input.channel);
  if (!connection) {
    throw new MarketingError('CONNECT_REQUIRED', `Connect your ${input.channel} profile before posting`, 409);
  }

  // LinkedIn → publish for real via the member's access token.
  if (input.channel === 'linkedin') {
    if (!connection.accessToken || !connection.providerId) {
      throw new MarketingError('CONNECT_REQUIRED', 'Reconnect your LinkedIn account to post', 409);
    }
    let urn = '';
    try {
      urn = await createMemberPost(connection.accessToken, `urn:li:person:${connection.providerId}`, input.body);
    } catch (err) {
      if (err instanceof LinkedInError) throw new MarketingError(err.code, err.message, err.status);
      throw err;
    }
    const row = await repo.createPostWithUrn({
      userId,
      channel: 'linkedin',
      body: input.body,
      mediaUrl: input.mediaUrl ?? null,
      providerPostUrn: urn || null,
    });
    return toPostView(row);
  }

  // Other channels (Facebook/Email) — demo posting with simulated reach/engagement.
  const impressions = randInt(150, 2000);
  const likes = Math.round(impressions * (randInt(20, 80) / 1000));
  const comments = Math.round(likes * (randInt(50, 200) / 1000));
  const shares = Math.round(likes * (randInt(30, 120) / 1000));
  const row = await repo.createPost({
    userId,
    channel: input.channel,
    body: input.body,
    mediaUrl: input.mediaUrl ?? null,
    likes,
    comments,
    shares,
    impressions,
  });
  return toPostView(row);
}
