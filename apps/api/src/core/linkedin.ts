import { env } from '../env.js';
import { logger } from '../logger.js';

/**
 * Thin client over LinkedIn's OAuth + REST APIs. Used by the marketing module to
 * connect a member's account (OpenID Connect), publish posts to their feed
 * (`w_member_social`), and read like/comment counts. All calls go through plain
 * `fetch`; hard failures throw `LinkedInError`.
 */

export class LinkedInError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 502,
  ) {
    super(message);
    this.name = 'LinkedInError';
  }
}

const OAUTH_BASE = 'https://www.linkedin.com/oauth/v2';
const API_BASE = 'https://api.linkedin.com';

/** True when all LinkedIn OAuth env vars are present. */
export function linkedinConfigured(): boolean {
  return Boolean(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET && env.LINKEDIN_REDIRECT_URI);
}

/** Build the consent URL the browser is sent to. */
export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.LINKEDIN_CLIENT_ID,
    redirect_uri: env.LINKEDIN_REDIRECT_URI,
    state,
    scope: env.LINKEDIN_SCOPES,
  });
  return `${OAUTH_BASE}/authorization?${params.toString()}`;
}

export type TokenResponse = { accessToken: string; expiresInSec: number; scope: string };

/** Exchange an authorization code for an access token. */
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.LINKEDIN_REDIRECT_URI,
    client_id: env.LINKEDIN_CLIENT_ID,
    client_secret: env.LINKEDIN_CLIENT_SECRET,
  });
  const res = await fetch(`${OAUTH_BASE}/accessToken`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    logger.error({ status: res.status, detail: (await res.text().catch(() => '')).slice(0, 300) }, 'linkedin.token_exchange_failed');
    throw new LinkedInError('TOKEN_EXCHANGE', 'Could not exchange LinkedIn code', 502);
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number; scope?: string };
  if (!json.access_token) throw new LinkedInError('TOKEN_EXCHANGE', 'LinkedIn returned no access token', 502);
  return { accessToken: json.access_token, expiresInSec: json.expires_in ?? 0, scope: json.scope ?? '' };
}

export type LinkedInProfile = { sub: string; name: string; picture: string | null; email: string | null };

/** Fetch the connected member's OpenID Connect profile. */
export async function fetchUserinfo(accessToken: string): Promise<LinkedInProfile> {
  const res = await fetch(`${API_BASE}/v2/userinfo`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new LinkedInError('USERINFO', 'Could not read LinkedIn profile', 502);
  const json = (await res.json()) as { sub?: string; name?: string; picture?: string; email?: string };
  if (!json.sub) throw new LinkedInError('USERINFO', 'LinkedIn profile had no id', 502);
  return { sub: json.sub, name: json.name ?? 'LinkedIn member', picture: json.picture ?? null, email: json.email ?? null };
}

/** Publish a text post to the member's feed. Returns the created post URN. */
export async function createMemberPost(accessToken: string, authorUrn: string, text: string): Promise<string> {
  const res = await fetch(`${API_BASE}/rest/posts`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'LinkedIn-Version': '202405',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: authorUrn,
      commentary: text,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!res.ok) {
    logger.error({ status: res.status, detail: (await res.text().catch(() => '')).slice(0, 300) }, 'linkedin.post_failed');
    if (res.status === 401) throw new LinkedInError('TOKEN_EXPIRED', 'LinkedIn session expired — reconnect', 401);
    throw new LinkedInError('POST_FAILED', 'Could not publish to LinkedIn', 502);
  }
  // The post URN is returned in the x-restli-id header (or x-linkedin-id).
  const urn = res.headers.get('x-restli-id') ?? res.headers.get('x-linkedin-id');
  if (urn) return urn;
  const json = (await res.json().catch(() => ({}))) as { id?: string };
  return json.id ?? '';
}

/** Best-effort like/comment counts for a post URN (needs elevated access; 0 if unavailable). */
export async function fetchSocialActions(accessToken: string, urn: string): Promise<{ likes: number; comments: number }> {
  try {
    const res = await fetch(`${API_BASE}/v2/socialActions/${encodeURIComponent(urn)}`, {
      headers: { authorization: `Bearer ${accessToken}`, 'X-Restli-Protocol-Version': '2.0.0' },
    });
    if (!res.ok) return { likes: 0, comments: 0 };
    const json = (await res.json()) as {
      likesSummary?: { totalLikes?: number };
      commentsSummary?: { aggregatedTotalComments?: number; count?: number };
    };
    return {
      likes: json.likesSummary?.totalLikes ?? 0,
      comments: json.commentsSummary?.aggregatedTotalComments ?? json.commentsSummary?.count ?? 0,
    };
  } catch {
    return { likes: 0, comments: 0 };
  }
}

/** Human-facing URL for a published post URN. */
export function postUrl(urn: string): string {
  return `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}`;
}
