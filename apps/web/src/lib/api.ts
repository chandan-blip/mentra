import { getAccessToken, getApiBaseUrl, refreshAccessToken } from './auth.js';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

type ApiEnvelope<T> = { data?: T; error?: { code: string; message: string } };

/**
 * Authenticated fetch against the Mentra API. Adds the bearer token, retries
 * once after a silent refresh on 401, and unwraps the `{ data, error }` envelope.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const run = async (token: string | null): Promise<Response> => {
    const headers = new Headers(init.headers);
    // Default to JSON, but respect an explicit Content-Type (e.g. binary uploads).
    if (!headers.has('Content-Type') && !(init.body instanceof Blob)) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(`${getApiBaseUrl()}${path}`, { ...init, headers, credentials: 'include' });
  };

  let response = await run(getAccessToken());
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await run(refreshed);
  }

  if (response.status === 204) return undefined as T;

  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok || body.error) {
    throw new ApiError(
      body.error?.code ?? 'REQUEST_FAILED',
      body.error?.message ?? 'Request failed',
      response.status,
    );
  }
  return body.data as T;
}
