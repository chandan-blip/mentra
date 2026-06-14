import type { Request, Response } from 'express';
import { env } from '../../env.js';
import { ackSchema } from './dashboard.schema.js';
import {
  acknowledgeRecommendation,
  getNextSteps,
  getOverview,
  getStats,
} from './dashboard.service.js';

const uid = (req: Request): string => req.auth!.sub;
const param = (req: Request, name: string): string => {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

export async function getOverviewHandler(req: Request, res: Response): Promise<void> {
  res.json({ data: await getOverview(uid(req)) });
}

export async function getNextStepsHandler(req: Request, res: Response): Promise<void> {
  const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : env.DASHBOARD_NEXT_STEPS_LIMIT;
  res.json({ data: await getNextSteps(uid(req), limit) });
}

export async function ackHandler(req: Request, res: Response): Promise<void> {
  const { action } = ackSchema.parse(req.body);
  await acknowledgeRecommendation(uid(req), param(req, 'recId'), action);
  res.status(204).send();
}

export async function getStatsHandler(req: Request, res: Response): Promise<void> {
  res.json({ data: await getStats(uid(req)) });
}
