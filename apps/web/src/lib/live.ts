import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChatMessageView,
  CreateLiveSessionInput,
  CreateUploadInput,
  JoinTokenResponse,
  LikeResultView,
  LiveSessionView,
  SessionSummary,
  UpdateLiveSessionInput,
  UploadInitResponse,
} from '@mentra/shared';
import { apiFetch } from './api.js';

const base = '/api/v1/live-session';

/** A dark, per-session gradient used as a placeholder stage background. */
export const stageBg = (hue: number) =>
  `radial-gradient(120% 120% at 30% 20%, hsl(${hue} 70% 22%), hsl(${(hue + 40) % 360} 60% 10%) 70%)`;

/** Stable hue derived from a session id so each session gets a consistent color. */
export function hueOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

/** A mm:ss timer counting up from a given ISO timestamp — the "live for" label. */
export function useElapsed(sinceIso: string | null): string {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (!sinceIso) return '00:00';
  const secs = Math.max(0, Math.floor((Date.now() - new Date(sinceIso).getTime()) / 1000));
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Format attended/elapsed seconds as a compact mm:ss / h:mm:ss label. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// --- Queries ---

export function useLiveSessions() {
  return useQuery({
    queryKey: ['live', 'live-now'],
    queryFn: () => apiFetch<LiveSessionView[]>(`${base}/sessions/live`),
    refetchInterval: 15_000,
  });
}

export function useUpcoming() {
  return useQuery({
    queryKey: ['live', 'upcoming'],
    queryFn: () => apiFetch<LiveSessionView[]>(`${base}/sessions/upcoming`),
  });
}

export function usePastSessions() {
  return useQuery({
    queryKey: ['live', 'past'],
    queryFn: () => apiFetch<LiveSessionView[]>(`${base}/sessions/past`),
  });
}

/** A single session for the watch page. Polls while open so processing→ready / live→ended flips show. */
export function useSession(id: string | null) {
  return useQuery({
    queryKey: ['live', 'session', id],
    queryFn: () => apiFetch<LiveSessionView>(`${base}/sessions/${id}`),
    enabled: Boolean(id),
    refetchInterval: 20_000,
  });
}

/** Persisted chat history — used as the comments list on a recorded session's watch page. */
export function useSessionMessages(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['live', 'messages', id],
    queryFn: () => apiFetch<ChatMessageView[]>(`${base}/sessions/${id}/messages`),
    enabled: Boolean(id) && enabled,
  });
}

export function useMyMentorSessions() {
  return useQuery({
    queryKey: ['live', 'mine'],
    queryFn: () => apiFetch<LiveSessionView[]>(`${base}/sessions/mine`),
  });
}

export function useSessionSummary(sessionId: string | null) {
  return useQuery({
    queryKey: ['live', 'summary', sessionId],
    queryFn: () => apiFetch<SessionSummary>(`${base}/sessions/${sessionId}/summary`),
    enabled: Boolean(sessionId),
  });
}

// --- Mutations ---

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLiveSessionInput) =>
      apiFetch<LiveSessionView>(`${base}/sessions`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['live', 'mine'] }),
  });
}

export function useScheduleSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLiveSessionInput }) =>
      apiFetch<LiveSessionView>(`${base}/sessions/${id}/schedule`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['live', 'mine'] }),
  });
}

export function useStartSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<LiveSessionView>(`${base}/sessions/${id}/start`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['live', 'mine'] });
      qc.invalidateQueries({ queryKey: ['live', 'live-now'] });
    },
  });
}

export function useEndSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<LiveSessionView>(`${base}/sessions/${id}/end`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['live', 'mine'] });
      qc.invalidateQueries({ queryKey: ['live', 'live-now'] });
    },
  });
}

export function useJoinToken() {
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<JoinTokenResponse>(`${base}/sessions/${id}/join-token`, { method: 'POST' }),
  });
}

/**
 * Like / unlike a session. The mutation input is the DESIRED state (true = like); on
 * success it patches the cached single-session view so the heart + count update in
 * place without a refetch.
 */
export function useToggleLike(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (next: boolean) =>
      apiFetch<LikeResultView>(`${base}/sessions/${sessionId}/like`, {
        method: next ? 'POST' : 'DELETE',
      }),
    onSuccess: (res) => {
      qc.setQueryData<LiveSessionView>(['live', 'session', sessionId], (prev) =>
        prev ? { ...prev, likedByViewer: res.liked, likeCount: res.likes } : prev,
      );
    },
  });
}

// --- Mentor upload (video → same HLS pipeline) ---

/** Step 1: create the row + get a presigned R2 PUT URL. */
export function useCreateUpload() {
  return useMutation({
    mutationFn: (input: CreateUploadInput) =>
      apiFetch<UploadInitResponse>(`${base}/sessions/upload`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

/** Step 2: PUT the file straight to R2 with progress. contentType MUST match the one
 *  sent to createUpload (the presigned URL signs it). */
export function uploadFileToR2(
  url: string,
  file: File,
  contentType: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (HTTP ${xhr.status})`));
    xhr.onerror = () => reject(new Error('Upload failed — check your connection and CORS.'));
    xhr.send(file);
  });
}

/** Step 3: verify + enqueue transcoding (same pipeline as live recordings). */
export function useFinalizeUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<LiveSessionView>(`${base}/sessions/${id}/upload/finalize`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['live', 'mine'] });
      qc.invalidateQueries({ queryKey: ['live', 'past'] });
    },
  });
}

// --- Resume watching (recording position) ---

/** Saved resume position for a recording. Fetched once when the player opens. */
export function useWatchProgress(sessionId: string | null) {
  return useQuery({
    queryKey: ['live', 'progress', sessionId],
    queryFn: () => apiFetch<{ positionSeconds: number }>(`${base}/sessions/${sessionId}/progress`),
    enabled: Boolean(sessionId),
    staleTime: Infinity,
  });
}

/** Fire-and-forget save of the current playback position (throttling is the caller's job). */
export function saveWatchProgress(sessionId: string, positionSeconds: number): void {
  void apiFetch(`${base}/sessions/${sessionId}/progress`, {
    method: 'PUT',
    body: JSON.stringify({ positionSeconds }),
  }).catch(() => {
    /* best-effort — resume is a convenience, never block playback on it */
  });
}
