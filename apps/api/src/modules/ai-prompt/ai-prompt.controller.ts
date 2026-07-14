import type { Request, Response } from 'express';
import { updateAiPromptSchema } from '@mentra/shared';
import { listPrompts, resetPrompt, updatePrompt } from './ai-prompt.service.js';

const param = (req: Request, name: string): string => {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

export async function getPrompts(_req: Request, res: Response): Promise<void> {
  res.json({ data: await listPrompts() });
}

export async function putPrompt(req: Request, res: Response): Promise<void> {
  const input = updateAiPromptSchema.parse(req.body ?? {});
  res.json({ data: await updatePrompt(param(req, 'key'), input, req.auth?.sub ?? null) });
}

export async function postResetPrompt(req: Request, res: Response): Promise<void> {
  res.json({ data: await resetPrompt(param(req, 'key')) });
}
