import { z } from 'zod';

// --- Ingestion (client-reported events: web now, mobile/OS later) ---

/**
 * Client event sources. `server` is never accepted from a client — it's set
 * internally when the event-bus recorder writes a domain event. Keeping `mobile`
 * and `os` here means the future mobile app can POST app-usage / screen-time
 * events to the same endpoint with no schema change.
 */
export const activitySourceSchema = z.enum(['web', 'mobile', 'os']);
export type ActivitySource = z.infer<typeof activitySourceSchema>;

export const activityEventInputSchema = z.object({
  /** Dotted event type, e.g. 'page.view', 'focus.session', 'app.usage'. */
  type: z.string().trim().min(1).max(100),
  source: activitySourceSchema.default('web'),
  /** ISO timestamp of when it happened on the client; defaults to server-now. */
  occurredAt: z.string().datetime().optional(),
  /** For duration-bearing events (a focus block, app-usage span). */
  durationSeconds: z.number().int().min(0).max(86_400).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type ActivityEventInput = z.infer<typeof activityEventInputSchema>;

export const ingestActivitySchema = z.object({
  events: z.array(activityEventInputSchema).min(1).max(100),
});
export type IngestActivityInput = z.infer<typeof ingestActivitySchema>;

// --- Views ---

export type ActivityEventView = {
  id: string;
  type: string;
  source: string;
  /** Human-readable label derived server-side from type + metadata. */
  title: string;
  metadata: Record<string, unknown> | null;
  durationSeconds: number | null;
  occurredAt: string;
};

/** One day in the activity heatmap. `day` is `YYYY-MM-DD`. */
export type ActivityHeatCell = { day: string; count: number };

export type ActivitySummaryView = {
  todayCount: number;
  weekCount: number;
  /** Consecutive active days ending today (or yesterday). */
  currentStreak: number;
  longestStreak: number;
  /** Per-day counts for the last ~12 weeks, for a contribution-style heatmap. */
  activeDays: ActivityHeatCell[];
};

export type ActivityFocusItem = {
  title: string;
  reason: string;
  action: string | null;
  href: string | null;
};

/** The "where to focus" guidance. `source` flags AI vs the rule-based fallback. */
export type ActivityFocusView = {
  headline: string;
  items: ActivityFocusItem[];
  generatedAt: string;
  source: 'ai' | 'rules';
};

/**
 * Curated, public-safe activity shown on another student's profile — never the raw
 * event log or any usage/screen-time data.
 */
export type PublicActivitySummary = {
  currentStreak: number;
  activeDays: ActivityHeatCell[];
  milestones: { title: string; occurredAt: string }[];
};
