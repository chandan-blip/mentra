import type { Request, Response } from 'express';
import { regenerateRoadmapSchema, submitRoadmapTestSchema } from '@mentra/shared';
import {
  getActiveRoadmapView,
  getHistory,
  getHistoryRoadmap,
  getSummary,
  getWeekView,
  itemAction,
  regenerate,
} from './roadmap.service.js';
import {
  getResults,
  getSubtopics,
  getTest,
  getTopicView,
  startTest,
  submitTest,
} from './topic/topic.service.js';

const uid = (req: Request): string => req.auth!.sub;
const param = (req: Request, name: string): string => {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

export async function getMe(req: Request, res: Response): Promise<void> {
  res.json({ data: await getActiveRoadmapView(uid(req)) });
}

export async function getSummaryHandler(req: Request, res: Response): Promise<void> {
  res.json({ data: await getSummary(uid(req)) });
}

export async function getWeekHandler(req: Request, res: Response): Promise<void> {
  const n = Number.parseInt(param(req, 'n'), 10);
  if (!Number.isInteger(n) || n < 1) {
    res.status(400).json({ error: { code: 'INVALID_WEEK', message: 'Week must be a positive integer' } });
    return;
  }
  res.json({ data: await getWeekView(uid(req), n) });
}

export async function postRegenerate(req: Request, res: Response): Promise<void> {
  const { reason } = regenerateRoadmapSchema.parse(req.body ?? {});
  res.json({ data: await regenerate(uid(req), reason) });
}

export async function getHistoryHandler(req: Request, res: Response): Promise<void> {
  res.json({ data: await getHistory(uid(req)) });
}

export async function getHistoryRoadmapHandler(req: Request, res: Response): Promise<void> {
  res.json({ data: await getHistoryRoadmap(uid(req), param(req, 'roadmapId')) });
}

export async function postStart(req: Request, res: Response): Promise<void> {
  res.json({ data: await itemAction(uid(req), param(req, 'id'), 'start') });
}

export async function postComplete(req: Request, res: Response): Promise<void> {
  res.json({ data: await itemAction(uid(req), param(req, 'id'), 'complete') });
}

// --- Topic subtopics + completion test ---

export async function getTopicHandler(req: Request, res: Response): Promise<void> {
  res.json({ data: await getTopicView(uid(req), param(req, 'id')) });
}

export async function getSubtopicsHandler(req: Request, res: Response): Promise<void> {
  res.json({ data: await getSubtopics(uid(req), param(req, 'id')) });
}

export async function postStartTest(req: Request, res: Response): Promise<void> {
  res.json({ data: await startTest(uid(req), param(req, 'id')) });
}

export async function getResultsHandler(req: Request, res: Response): Promise<void> {
  res.json({ data: await getResults(uid(req), param(req, 'id')) });
}

export async function getTestHandler(req: Request, res: Response): Promise<void> {
  res.json({ data: await getTest(uid(req), param(req, 'testId')) });
}

export async function postSubmitTest(req: Request, res: Response): Promise<void> {
  const body = submitRoadmapTestSchema.parse(req.body ?? {});
  res.json({ data: await submitTest(uid(req), param(req, 'testId'), body) });
}
