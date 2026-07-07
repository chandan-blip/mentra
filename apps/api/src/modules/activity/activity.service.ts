import { z } from 'zod';
import type {
  ActivityEventView,
  ActivityFocusView,
  ActivitySummaryView,
  IngestActivityInput,
  PublicActivitySummary,
} from '@mentra/shared';
import { generateJson } from '../../core/ai.js';
import { logger } from '../../logger.js';
import { getSummary as getRoadmapSummary } from '../roadmap/roadmap.service.js';
import { getAssignmentStatus } from '../assignment/assignment.service.js';
import {
  type ActivityRow,
  countSince,
  dailyCounts,
  getFocusCache,
  insertEvents,
  listRecent,
  upsertFocusCache,
} from './activity.repository.js';

const DAY_MS = 86_400_000;
const FOCUS_TTL_MS = 6 * 60 * 60_000; // regenerate AI focus at most every 6h

/** Event types that count as public-safe learning milestones. */
const MILESTONE_TYPES = [
  'onboarding.completed',
  'roadmap.generated',
  'roadmap.item.completed',
  'assignment.completed',
  'live-session.ended',
  'learning.series.completed',
];

const iso = (d: Date | string): string => new Date(d).toISOString();

/** Local `YYYY-MM-DD` — matched to the DB's DATE_FORMAT (server-tz) day buckets. */
const dayKey = (d: Date): string => d.toLocaleDateString('en-CA');

/** Human label for an event, from its type + metadata. */
function titleFor(type: string, meta: Record<string, unknown> | null): string {
  switch (type) {
    case 'onboarding.completed':
      return 'Completed onboarding';
    case 'roadmap.generated':
      return 'Generated a new roadmap';
    case 'roadmap.item.completed':
      return 'Completed a roadmap item';
    case 'assignment.generated':
      return 'Started a personalized assignment';
    case 'assignment.completed':
      return typeof meta?.score === 'number' ? `Completed the assignment (${meta.score}%)` : 'Completed the assignment';
    case 'learning.test.completed':
      return meta?.passed
        ? `Passed a test${typeof meta?.percent === 'number' ? ` (${meta.percent}%)` : ''}`
        : `Attempted a test${typeof meta?.percent === 'number' ? ` (${meta.percent}%)` : ''}`;
    case 'learning.series.completed':
      return 'Completed a test series';
    case 'live-session.started':
      return 'Started a live session';
    case 'live-session.ended':
      return 'Wrapped up a live session';
    case 'page.view':
      return typeof meta?.label === 'string' ? `Opened ${meta.label}` : 'Opened a page';
    case 'focus.session':
      return 'Logged a focus session';
    case 'app.usage':
      return typeof meta?.app === 'string' ? `Used ${meta.app}` : 'Logged app usage';
    default:
      return type.replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  }
}

function toView(r: ActivityRow): ActivityEventView {
  return {
    id: r.id,
    type: r.type,
    source: r.source,
    title: titleFor(r.type, r.metadata),
    metadata: r.metadata,
    durationSeconds: r.durationSeconds,
    occurredAt: iso(r.occurredAt),
  };
}

// --- Ingestion ---

/** Persist client-reported events (web now; mobile/OS later — same shape). */
export async function ingestClientEvents(
  userId: string,
  input: IngestActivityInput,
): Promise<{ recorded: number }> {
  const now = Date.now();
  const rows = input.events.map((e) => {
    let at = e.occurredAt ? new Date(e.occurredAt) : new Date();
    const t = at.getTime();
    // Clamp to a sane window: never future, never older than 30 days (guards against
    // a bad client clock skewing streaks / heatmaps).
    if (Number.isNaN(t) || t > now + 60_000) at = new Date();
    else if (t < now - 30 * DAY_MS) at = new Date(now - 30 * DAY_MS);
    return {
      userId,
      type: e.type,
      source: e.source,
      metadata: e.metadata ?? null,
      durationSeconds: e.durationSeconds ?? null,
      occurredAt: at,
    };
  });
  await insertEvents(rows);
  return { recorded: rows.length };
}

// --- Timeline + summary ---

export async function getTimeline(userId: string, limit = 30): Promise<ActivityEventView[]> {
  const rows = await listRecent(userId, Math.min(Math.max(limit, 1), 100));
  return rows.map(toView);
}

export async function getSummary(userId: string): Promise<ActivitySummaryView> {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const weekAgo = new Date(startToday.getTime() - 6 * DAY_MS);
  const heatSince = new Date(startToday.getTime() - 83 * DAY_MS);

  const [todayCount, weekCount, days] = await Promise.all([
    countSince(userId, startToday),
    countSince(userId, weekAgo),
    dailyCounts(userId, heatSince),
  ]);

  const { current, longest } = computeStreaks(days);
  return { todayCount, weekCount, currentStreak: current, longestStreak: longest, activeDays: days };
}

/** Curated, public-safe subset — streak, heatmap, and recent learning milestones only. */
export async function getPublicSummary(userId: string): Promise<PublicActivitySummary> {
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const heatSince = new Date(startToday.getTime() - 83 * DAY_MS);

  const [days, milestones] = await Promise.all([
    dailyCounts(userId, heatSince),
    listRecent(userId, 8, MILESTONE_TYPES),
  ]);

  const { current } = computeStreaks(days);
  return {
    currentStreak: current,
    activeDays: days,
    milestones: milestones.map((m) => ({ title: titleFor(m.type, m.metadata), occurredAt: iso(m.occurredAt) })),
  };
}

function computeStreaks(days: { day: string; count: number }[]): { current: number; longest: number } {
  const active = new Set(days.filter((d) => d.count > 0).map((d) => d.day));

  // Longest run of consecutive active days.
  const sorted = [...active].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && isNextDay(prev, d) ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  // Current streak: walk back from today (or yesterday, if today is idle so far).
  const cursor = new Date();
  if (!active.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (active.has(dayKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current, longest };
}

function isNextDay(a: string, b: string): boolean {
  const d = new Date(`${a}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return dayKey(d) === b;
}

// --- "Where to focus" (AI, cached, rule-based fallback) ---

type Signals = {
  currentStreak: number;
  daysSinceActive: number | null;
  weekCount: number;
  roadmap: {
    hasRoadmap: boolean;
    percentComplete: number;
    currentWeek: number;
    completedItems: number;
    totalItems: number;
  };
  assignment: { status: string; score: number | null };
};

const TARGET_HREF: Record<string, string> = {
  roadmap: '/roadmap',
  assignment: '/assignment',
  community: '/community',
  students: '/students',
  mentors: '/mentors',
  analytics: '/analytics',
};

const focusAiSchema = z.object({
  headline: z.string().min(1).max(200),
  items: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        reason: z.string().min(1).max(300),
        action: z.string().max(80).nullable().optional(),
        target: z
          .enum(['roadmap', 'assignment', 'community', 'students', 'mentors', 'analytics'])
          .nullable()
          .optional(),
      }),
    )
    .min(1)
    .max(4),
});

async function gatherSignals(userId: string): Promise<Signals> {
  const [summary, roadmap, assignment] = await Promise.all([
    getSummary(userId),
    getRoadmapSummary(userId).catch(() => null),
    getAssignmentStatus(userId).catch(() => null),
  ]);

  const lastActive = summary.activeDays.filter((d) => d.count > 0).map((d) => d.day).sort().pop() ?? null;
  const daysSinceActive =
    lastActive == null
      ? null
      : Math.max(0, Math.round((Date.now() - new Date(`${lastActive}T00:00:00`).getTime()) / DAY_MS));

  return {
    currentStreak: summary.currentStreak,
    daysSinceActive,
    weekCount: summary.weekCount,
    roadmap: {
      hasRoadmap: Boolean(roadmap?.hasRoadmap),
      percentComplete: roadmap?.percentComplete ?? 0,
      currentWeek: roadmap?.currentWeek ?? 1,
      completedItems: roadmap?.completedItems ?? 0,
      totalItems: roadmap?.totalItems ?? 0,
    },
    assignment: { status: assignment?.status ?? 'unknown', score: assignment?.score ?? null },
  };
}

/** Tiny stable hash (djb2) so we only re-call the model when the signals change. */
function hashSignals(signals: Signals): string {
  const str = JSON.stringify(signals);
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

export async function getFocus(userId: string): Promise<ActivityFocusView> {
  const signals = await gatherSignals(userId);
  const hash = hashSignals(signals);

  const cache = await getFocusCache(userId);
  if (
    cache &&
    cache.signalsHash === hash &&
    Date.now() - new Date(cache.generatedAt).getTime() < FOCUS_TTL_MS &&
    cache.payload
  ) {
    return cache.payload as ActivityFocusView;
  }

  let view: ActivityFocusView;
  try {
    const ai = await generateJson({
      system:
        'You are a career-growth coach inside a learning platform. Given a JSON snapshot of a ' +
        "student's progress signals, tell them where to focus next. Respond with JSON only, no prose. " +
        'Be specific, encouraging, and concrete. Each item needs a short title and a one-sentence reason. ' +
        'Set `target` to the most relevant app area or null. Never invent data not present in the signals.',
      user: `Student signals:\n${JSON.stringify(signals, null, 2)}\n\nReturn 2-3 focus items.`,
      schema: focusAiSchema,
      temperature: 0.5,
    });
    view = {
      headline: ai.headline,
      items: ai.items.map((it) => ({
        title: it.title,
        reason: it.reason,
        action: it.action ?? null,
        href: it.target ? (TARGET_HREF[it.target] ?? null) : null,
      })),
      generatedAt: iso(new Date()),
      source: 'ai',
    };
  } catch (err) {
    logger.warn({ err, userId }, 'activity.focus AI failed; using rule-based fallback');
    view = ruleBasedFocus(signals);
  }

  await upsertFocusCache(userId, view, hash);
  return view;
}

/** Deterministic focus when the model is unavailable — never leaves the user empty. */
function ruleBasedFocus(s: Signals): ActivityFocusView {
  const items: ActivityFocusView['items'] = [];

  if (s.assignment.status !== 'completed') {
    items.push({
      title: 'Take your assignment',
      reason: 'Your personalized roadmap is built from it — this unlocks everything else.',
      action: 'Start assignment',
      href: '/assignment',
    });
  } else if (s.roadmap.hasRoadmap && s.roadmap.percentComplete < 100) {
    items.push({
      title: `Continue week ${s.roadmap.currentWeek} of your roadmap`,
      reason: `You're ${s.roadmap.percentComplete}% through (${s.roadmap.completedItems}/${s.roadmap.totalItems} items).`,
      action: 'Open roadmap',
      href: '/roadmap',
    });
  }

  if (s.daysSinceActive != null && s.daysSinceActive >= 3) {
    items.push({
      title: 'Get back into a rhythm',
      reason: `It's been ${s.daysSinceActive} days since your last activity — a short session today rebuilds momentum.`,
      action: 'Browse community',
      href: '/community',
    });
  } else if (s.currentStreak > 0) {
    items.push({
      title: `Keep your ${s.currentStreak}-day streak alive`,
      reason: 'Consistency compounds — do one thing today to extend it.',
      action: null,
      href: null,
    });
  }

  if (items.length === 0) {
    items.push({
      title: 'Explore what other students are learning',
      reason: 'Discover people to follow and ideas to borrow.',
      action: 'Browse students',
      href: '/students',
    });
  }

  return {
    headline: s.currentStreak > 0 ? `You're on a ${s.currentStreak}-day streak` : 'Here’s where to focus next',
    items: items.slice(0, 3),
    generatedAt: iso(new Date()),
    source: 'rules',
  };
}
