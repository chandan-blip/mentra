import type { Request, Response } from 'express';
import { enrollCareerChatSchema, sendCareerChatSchema } from '@mentra/shared';
import { enroll, getConversation, nudge, sendMessage } from './career-chat.service.js';

const uid = (req: Request): string => req.auth!.sub;

export async function getMessages(req: Request, res: Response): Promise<void> {
  res.json({ data: await getConversation(uid(req)) });
}

export async function postNudge(req: Request, res: Response): Promise<void> {
  res.json({ data: await nudge(uid(req)) });
}

export async function postMessage(req: Request, res: Response): Promise<void> {
  const input = sendCareerChatSchema.parse(req.body ?? {});
  res.json({ data: await sendMessage(uid(req), input) });
}

export async function postEnroll(req: Request, res: Response): Promise<void> {
  const input = enrollCareerChatSchema.parse(req.body ?? {});
  res.json({ data: await enroll(uid(req), input) });
}
