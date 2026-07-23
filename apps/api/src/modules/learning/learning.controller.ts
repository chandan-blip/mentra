import type { Request, Response } from 'express';
import { customLearningRequestSchema, submitLearningTestSchema } from '@mentra/shared';
import {
  createCustomQuiz,
  getCategory,
  getProgress,
  getTest,
  listCategories,
  searchTopics,
  startTest,
  submitTest,
} from './learning.service.js';

const uid = (req: Request): string => req.auth!.sub;
const id = (req: Request): string => {
  const v = req.params.id;
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

export async function getCategories(req: Request, res: Response): Promise<void> {
  res.json({ data: await listCategories(uid(req)) });
}

export async function getCategoryById(req: Request, res: Response): Promise<void> {
  res.json({ data: await getCategory(uid(req), id(req)) });
}

export async function postStartTest(req: Request, res: Response): Promise<void> {
  res.json({ data: await startTest(uid(req), id(req)) });
}

export async function getTestById(req: Request, res: Response): Promise<void> {
  res.json({ data: await getTest(uid(req), id(req)) });
}

export async function postSubmitTest(req: Request, res: Response): Promise<void> {
  const body = submitLearningTestSchema.parse(req.body ?? {});
  res.json({ data: await submitTest(uid(req), id(req), body) });
}

export async function getLearningProgress(req: Request, res: Response): Promise<void> {
  res.json({ data: await getProgress(uid(req)) });
}

export async function getTopicSearch(req: Request, res: Response): Promise<void> {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  res.json({ data: await searchTopics(uid(req), q) });
}

export async function postCustomQuiz(req: Request, res: Response): Promise<void> {
  const body = customLearningRequestSchema.parse(req.body ?? {});
  res.json({ data: await createCustomQuiz(uid(req), body) });
}
