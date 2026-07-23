import type { Request, Response } from 'express';
import { createCodingTaskSchema, submitCodingSchema, updateCodingTaskSchema } from '@mentra/shared';
import {
  createTask,
  getProgress,
  getTask,
  listTaskSubmissions,
  listTasks,
  listTasksAdmin,
  removeTask,
  submit,
  updateTaskById,
} from './coding.service.js';

const uid = (req: Request): string => req.auth!.sub;
const param = (req: Request, name: string): string => {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};
const id = (req: Request): string => param(req, 'id');

// --- Student ---

export async function getTasks(req: Request, res: Response): Promise<void> {
  res.json({ data: await listTasks(uid(req)) });
}

export async function getTaskDetail(req: Request, res: Response): Promise<void> {
  res.json({ data: await getTask(uid(req), id(req)) });
}

export async function postSubmit(req: Request, res: Response): Promise<void> {
  const body = submitCodingSchema.parse(req.body ?? {});
  res.json({ data: await submit(uid(req), param(req, 'taskId'), param(req, 'questionId'), body) });
}

export async function getProgressSummary(req: Request, res: Response): Promise<void> {
  res.json({ data: await getProgress(uid(req)) });
}

// --- Manager ---

export async function getAdminTasks(_req: Request, res: Response): Promise<void> {
  res.json({ data: await listTasksAdmin() });
}

export async function postTask(req: Request, res: Response): Promise<void> {
  const body = createCodingTaskSchema.parse(req.body ?? {});
  res.json({ data: await createTask(uid(req), body) });
}

export async function patchTask(req: Request, res: Response): Promise<void> {
  const body = updateCodingTaskSchema.parse(req.body ?? {});
  res.json({ data: await updateTaskById(id(req), body) });
}

export async function deleteTaskById(req: Request, res: Response): Promise<void> {
  await removeTask(id(req));
  res.json({ data: { ok: true } });
}

export async function getTaskSubmissions(req: Request, res: Response): Promise<void> {
  res.json({ data: await listTaskSubmissions(id(req)) });
}
