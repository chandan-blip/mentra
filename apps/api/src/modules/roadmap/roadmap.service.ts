import type {
  RoadmapHistoryEntry,
  RoadmapItemActionResult,
  RoadmapItemView,
  RoadmapSummary,
  RoadmapView,
  RoadmapWeekView,
} from '@mentra/shared';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { emit } from '../../core/events.js';
import { redis } from '../../core/redis.js';
import { getProfile } from '../user-profile/index.js';
import { getAssignmentResultForUser } from '../assignment/index.js';
import { getGenerator, type GeneratorInput } from './generator/index.js';
import { RoadmapError } from './roadmap.errors.js';
import { nextStatusFor, resolveUnlocks, type ItemAction } from './transitions/item-transition.service.js';
import {
  type RoadmapItemRow,
  type RoadmapRow,
  createRoadmapFromPlan,
  findActiveRoadmap,
  findItemWithContext,
  findRoadmapById,
  listItemsByRoadmap,
  listRoadmapsByUser,
  listWeeks,
  updateItemStatus,
} from './roadmap.repository.js';

// --- Generation ---

export async function generateForUser(
  userId: string,
  source: string,
  basisAttemptId: string | null,
): Promise<string> {
  const [profile, assignment] = await Promise.all([
    getProfile(userId),
    getAssignmentResultForUser(userId),
  ]);
  const input: GeneratorInput = {
    userId,
    // Skill scores came from the removed assessment; the generator now leans on
    // the tech stack + the completed assignment instead.
    skillMatrix: [],
    goal: profile.goal,
    targetRoles: profile.targetRoles,
    techStack: profile.techStack,
    studyHoursPerDay: profile.studyHoursPerDay,
    basisAttemptId,
    assignment,
  };

  const generator = getGenerator();
  logger.info({ userId, source, strategy: generator.id }, 'roadmap.generation.requested');
  const started = Date.now();
  const plan = await generator.generate(input);
  const generateMs = Date.now() - started;
  // Surface a generation that blows past the budget — the AI generator may be slow
  // (runbook: fall back via ROADMAP_GENERATOR_STRATEGY=default).
  if (generateMs > env.ROADMAP_GENERATOR_TIMEOUT_MS) {
    logger.warn(
      { userId, strategy: generator.id, generateMs, budgetMs: env.ROADMAP_GENERATOR_TIMEOUT_MS },
      'roadmap.generation.slow',
    );
  }

  const roadmapId = await createRoadmapFromPlan({
    userId,
    generatedBy: generator.id,
    basisAttemptId,
    plan,
  });

  logger.info(
    { userId, source, strategy: generator.id, durationMs: Date.now() - started, totalWeeks: plan.totalWeeks, totalItems: plan.weeks.reduce((n, w) => n + w.items.length, 0) },
    'roadmap.generation.succeeded',
  );
  emit('roadmap.generated', { userId, roadmapId, source });
  return roadmapId;
}

/** Auto-regeneration with a per-user throttle (Redis lock). Returns true if it ran. */
export async function autoRegenerate(userId: string, source: string): Promise<boolean> {
  const key = `roadmap:autoregen:${userId}`;
  const ok = await redis.set(key, '1', 'EX', env.ROADMAP_AUTO_REGEN_THROTTLE_SECONDS, 'NX');
  if (ok !== 'OK') return false;
  try {
    await generateForUser(userId, source, null);
    return true;
  } catch (err) {
    logger.error({ err, userId }, 'roadmap auto-regeneration failed');
    return false;
  }
}

export async function regenerate(userId: string, reason: string | undefined): Promise<RoadmapView> {
  logger.info({ userId, reason }, 'roadmap.generation.requested (manual)');
  await generateForUser(userId, 'manual', null);
  const view = await getActiveRoadmapView(userId);
  if (!view) throw new RoadmapError('ROADMAP_MISSING', 'Roadmap not found after generation', 500);
  return view;
}

// --- Read / views ---

function toItemView(row: RoadmapItemRow): RoadmapItemView {
  return {
    id: row.id,
    weekId: row.weekId,
    order: row.order,
    type: row.type,
    title: row.title,
    description: row.description,
    skillIds: row.skillIds ?? [],
    estimatedMin: row.estimatedMin,
    dependsOnIds: row.dependsOnIds ?? [],
    status: row.status,
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
  };
}

async function buildView(roadmap: RoadmapRow): Promise<RoadmapView> {
  const [weeks, items] = await Promise.all([listWeeks(roadmap.id), listItemsByRoadmap(roadmap.id)]);
  const byWeek = new Map<string, RoadmapItemView[]>();
  for (const it of items) {
    const arr = byWeek.get(it.weekId) ?? [];
    arr.push(toItemView(it));
    byWeek.set(it.weekId, arr);
  }

  const weekViews: RoadmapWeekView[] = weeks.map((w) => ({
    id: w.id,
    weekNumber: w.weekNumber,
    title: w.title,
    theme: w.theme,
    items: byWeek.get(w.id) ?? [],
  }));

  const total = items.length;
  const completed = items.filter((i) => i.status === 'completed').length;
  const currentWeek =
    weekViews.find((w) => w.items.some((i) => i.status !== 'completed' && i.status !== 'skipped'))
      ?.weekNumber ?? 1;

  return {
    id: roadmap.id,
    status: roadmap.status,
    generatedBy: roadmap.generatedBy,
    totalWeeks: roadmap.totalWeeks,
    startedOn: new Date(roadmap.startedOn).toISOString(),
    currentWeek,
    completedItems: completed,
    totalItems: total,
    percentComplete: total > 0 ? Math.round((completed / total) * 100) : 0,
    weeks: weekViews,
  };
}

export async function getActiveRoadmapView(userId: string): Promise<RoadmapView | null> {
  const roadmap = await findActiveRoadmap(userId);
  return roadmap ? buildView(roadmap) : null;
}

export async function getWeekView(userId: string, weekNumber: number): Promise<RoadmapWeekView> {
  const view = await getActiveRoadmapView(userId);
  const week = view?.weeks.find((w) => w.weekNumber === weekNumber);
  if (!week) throw new RoadmapError('WEEK_NOT_FOUND', `Week ${weekNumber} not found`, 404);
  return week;
}

export async function getSummary(userId: string): Promise<RoadmapSummary> {
  const roadmap = await findActiveRoadmap(userId);
  if (!roadmap) {
    return { hasRoadmap: false, totalWeeks: 0, completedItems: 0, totalItems: 0, percentComplete: 0, currentWeek: 1 };
  }
  const view = await buildView(roadmap);
  return {
    hasRoadmap: true,
    totalWeeks: view.totalWeeks,
    completedItems: view.completedItems,
    totalItems: view.totalItems,
    percentComplete: view.percentComplete,
    currentWeek: view.currentWeek,
  };
}

export async function getHistory(userId: string): Promise<RoadmapHistoryEntry[]> {
  const rows = await listRoadmapsByUser(userId);
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    generatedBy: r.generatedBy,
    totalWeeks: r.totalWeeks,
    startedOn: new Date(r.startedOn).toISOString(),
    archivedAt: r.archivedAt ? new Date(r.archivedAt).toISOString() : null,
  }));
}

export async function getHistoryRoadmap(userId: string, roadmapId: string): Promise<RoadmapView> {
  const roadmap = await findRoadmapById(roadmapId);
  if (!roadmap || roadmap.userId !== userId) {
    throw new RoadmapError('ROADMAP_NOT_FOUND', 'Roadmap not found', 404);
  }
  return buildView(roadmap);
}

// --- Item actions ---

export async function itemAction(
  userId: string,
  itemId: string,
  action: ItemAction,
): Promise<RoadmapItemActionResult> {
  const item = await findItemWithContext(itemId);
  if (!item || item.userId !== userId) {
    throw new RoadmapError('ITEM_NOT_FOUND', 'Roadmap item not found', 404);
  }
  if (item.roadmapStatus !== 'active') {
    throw new RoadmapError('ROADMAP_NOT_ACTIVE', 'Cannot modify an archived roadmap', 409);
  }
  // Topics are completed only by passing their test (see topic/topic.service.ts) —
  // never via the generic complete action. This is the authoritative guard; the UI
  // also hides the button, but the API must refuse regardless of client.
  if (action === 'complete' && item.type === 'topic') {
    throw new RoadmapError(
      'TOPIC_REQUIRES_TEST',
      'Complete this topic by passing its test, not by marking it done',
      409,
    );
  }

  const next = nextStatusFor(action, item.status);
  const completedAt = next === 'completed' ? new Date() : item.completedAt;
  await updateItemStatus(itemId, next, completedAt ?? null);
  logger.info({ itemId, from: item.status, to: next }, 'roadmap.item.transition');

  let unlocked: string[] = [];
  if (next === 'completed') {
    unlocked = await resolveUnlocks(item.roadmapId);
  }
  if (next === 'completed') {
    emit('roadmap.item.completed', { userId, roadmapId: item.roadmapId, itemId });
  }

  return { status: next, unlocked };
}

// --- Cross-module exports ---

export async function getActiveRoadmap(userId: string): Promise<RoadmapView | null> {
  return getActiveRoadmapView(userId);
}

export async function getRoadmapSummary(userId: string): Promise<RoadmapSummary> {
  return getSummary(userId);
}
