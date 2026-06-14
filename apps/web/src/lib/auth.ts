export const accessTokenKey = 'mentra_access_token';
export const userKey = 'mentra_user';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'mentor' | 'admin';
  createdAt?: string;
};

export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  if (configured) return configured.replace(/\/$/, '');

  // No VITE_API_URL (i.e. `vite dev`): use the dev server's own origin so requests
  // are same-origin and Vite's proxy forwards /api + /socket.io to the backend —
  // no CORS, cookies work, and HMR stays intact. Production builds always set
  // VITE_API_URL, so this branch only runs in development.
  return window.location.origin;
}

/**
 * Resolve an avatar URL for use in an <img>. Our uploaded avatars are stored as
 * root-relative API paths (`/api/v1/profile/avatar/...`) — prefix them with the API
 * origin so they load whether or not the web app shares the API's origin. Absolute
 * URLs (e.g. external/Gravatar) are returned unchanged.
 */
export function resolveAvatarUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith('/') ? `${getApiBaseUrl()}${url}` : url;
}

export function getAccessToken() {
  return window.localStorage.getItem(accessTokenKey);
}

export function storeAuthSession(input: { accessToken: string; user: AuthUser }) {
  window.localStorage.setItem(accessTokenKey, input.accessToken);
  window.localStorage.setItem(userKey, JSON.stringify(input.user));
}

export function getStoredUser(): AuthUser | null {
  const value = window.localStorage.getItem(userKey);
  if (!value) return null;

  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  window.localStorage.removeItem(accessTokenKey);
  window.localStorage.removeItem(userKey);
}

export async function refreshAccessToken() {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) return null;

  const body = (await response.json()) as {
    data?: { accessToken: string; user: AuthUser };
  };

  if (!body.data) return null;
  storeAuthSession(body.data);
  return body.data.accessToken;
}

/** Validates the stored session against the API, refreshing once on 401. */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  let token = getAccessToken();
  if (!token) return null;
  const hit = async (t: string) =>
    fetch(`${getApiBaseUrl()}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${t}` },
      credentials: 'include',
    });

  let response = await hit(token);
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) return null;
    token = refreshed;
    response = await hit(token);
  }
  if (!response.ok) return null;
  const body = (await response.json()) as { data?: AuthUser };
  if (!body.data) return null;
  storeAuthSession({ accessToken: token, user: body.data });
  return body.data;
}
