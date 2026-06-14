import type { Request, Response } from 'express';
import { connectChannelSchema, createMarketingPostSchema } from '@mentra/shared';
import { env } from '../../env.js';
import {
  connectChannel,
  createPost,
  disconnectChannel,
  getLinkedInAuthUrl,
  handleLinkedInCallback,
  listConnections,
  listPosts,
  syncLinkedInStats,
} from './marketing.service.js';

const uid = (req: Request): string => req.auth!.sub;
const param = (req: Request, name: string): string => {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

export async function getConnections(req: Request, res: Response): Promise<void> {
  res.json({ data: await listConnections(uid(req)) });
}

export async function getPosts(req: Request, res: Response): Promise<void> {
  const channel = typeof req.query.channel === 'string' ? req.query.channel : '';
  res.json({ data: await listPosts(uid(req), channel) });
}

export async function postPost(req: Request, res: Response): Promise<void> {
  const input = createMarketingPostSchema.parse(req.body ?? {});
  res.json({ data: await createPost(uid(req), input) });
}

export async function postConnect(req: Request, res: Response): Promise<void> {
  const input = connectChannelSchema.parse(req.body ?? {});
  res.json({ data: await connectChannel(uid(req), input) });
}

export async function deleteConnect(req: Request, res: Response): Promise<void> {
  res.json({ data: await disconnectChannel(uid(req), param(req, 'channel')) });
}

// --- LinkedIn OAuth ---

export async function getAuthUrl(req: Request, res: Response): Promise<void> {
  res.json({ data: await getLinkedInAuthUrl(uid(req)) });
}

export async function postSync(req: Request, res: Response): Promise<void> {
  res.json({ data: await syncLinkedInStats(uid(req)) });
}

/** Public OAuth callback — a top-level browser redirect, so it always redirects (never JSON). */
export async function linkedinCallback(req: Request, res: Response): Promise<void> {
  const base = env.WEB_APP_ORIGIN;
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  if (!code || !state) {
    res.redirect(302, `${base}/linkedin?error=denied`);
    return;
  }
  try {
    await handleLinkedInCallback(code, state);
    res.redirect(302, `${base}/linkedin?connected=1`);
  } catch (err) {
    req.log.error({ err }, 'linkedin callback failed');
    res.redirect(302, `${base}/linkedin?error=connect_failed`);
  }
}
