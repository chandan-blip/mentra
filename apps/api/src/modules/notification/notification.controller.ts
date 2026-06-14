import type { Request, Response } from 'express';
import { listForUser, markAllRead, markRead, unreadCount } from './notification.service.js';

const uid = (req: Request): string => req.auth!.sub;
const param = (req: Request, name: string): string => {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

export async function getNotifications(req: Request, res: Response): Promise<void> {
  res.json({ data: await listForUser(uid(req)) });
}

export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  res.json({ data: { count: await unreadCount(uid(req)) } });
}

export async function postRead(req: Request, res: Response): Promise<void> {
  await markRead(uid(req), param(req, 'id'));
  res.json({ data: { ok: true } });
}

export async function postReadAll(req: Request, res: Response): Promise<void> {
  await markAllRead(uid(req));
  res.json({ data: { ok: true } });
}
