import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type {
  ActivityEventInput,
  ActivityEventView,
  ActivityFocusView,
  ActivitySummaryView,
  PublicActivitySummary,
} from '@mentra/shared';
import { apiFetch } from './api.js';
import { getAccessToken } from './auth.js';

const base = '/api/v1/activity';

// --- Reads ---

export function useActivitySummary() {
  return useQuery({
    queryKey: ['activity', 'summary'],
    queryFn: () => apiFetch<ActivitySummaryView>(`${base}/me/summary`),
    staleTime: 60_000,
  });
}

export function useActivityFocus() {
  return useQuery({
    queryKey: ['activity', 'focus'],
    queryFn: () => apiFetch<ActivityFocusView>(`${base}/me/focus`),
    staleTime: 5 * 60_000,
  });
}

export function useActivityTimeline(limit = 30) {
  return useQuery({
    queryKey: ['activity', 'timeline', limit],
    queryFn: () => apiFetch<ActivityEventView[]>(`${base}/me?limit=${limit}`),
    staleTime: 30_000,
  });
}

/** Curated, public-safe activity for another student's profile. */
export function usePublicActivitySummary(userId: string | undefined) {
  return useQuery({
    queryKey: ['activity', 'public-summary', userId],
    queryFn: () => apiFetch<PublicActivitySummary>(`${base}/${userId}/summary`),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}

// --- Client tracking (batched) ---
//
// Events are queued in memory and flushed together, so a burst of page views costs
// one request. The same queue + endpoint will serve the mobile app (source:'mobile'
// / 'os') — nothing here is web-specific except the beforeunload flush.

let queue: ActivityEventInput[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0 || !getAccessToken()) return;
  const events = queue;
  queue = [];
  try {
    await apiFetch(`${base}/events`, { method: 'POST', body: JSON.stringify({ events }) });
  } catch {
    // Best-effort telemetry — drop on failure rather than growing the queue unbounded.
  }
}

/** Queue a client activity event; flushed on a short debounce. */
export function trackEvent(event: ActivityEventInput): void {
  queue.push(event);
  if (queue.length >= 20) {
    void flush();
    return;
  }
  if (!flushTimer) flushTimer = setTimeout(() => void flush(), 4000);
}

/**
 * Records a `page.view` on every route change. Mount once, high in the app tree.
 * `label` comes from a route→name map so events read nicely ("Opened Roadmap").
 */
export function usePageViewTracking(labelFor?: (path: string) => string | undefined): void {
  const location = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const path = location.pathname;
    if (lastPath.current === path) return;
    lastPath.current = path;
    trackEvent({
      type: 'page.view',
      source: 'web',
      occurredAt: new Date().toISOString(),
      metadata: { path, label: labelFor?.(path) ?? undefined },
    });
  }, [location.pathname, labelFor]);

  // Flush any queued events when the tab is hidden or closed.
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);
}
