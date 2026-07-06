import type { Request, Response } from 'express';
import {
  createCommentSchema,
  createPostSchema,
  updateCommentSchema,
  updatePostSchema,
} from '@mentra/shared';
import {
  createComment,
  createPost,
  deleteComment,
  deletePost,
  listFeed,
  listThread,
  searchMembers,
  togglePin,
  updateComment,
  updatePost,
} from './community.service.js';

const uid = (req: Request): string => req.auth!.sub;
const param = (req: Request, name: string): string => {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

export async function getPosts(req: Request, res: Response): Promise<void> {
  // `?author=<userId>` narrows the feed to one student's posts (their profile activity).
  const author = typeof req.query.author === 'string' ? req.query.author : undefined;
  res.json({ data: await listFeed(uid(req), author) });
}

export async function postPost(req: Request, res: Response): Promise<void> {
  const input = createPostSchema.parse(req.body ?? {});
  res.json({ data: await createPost(uid(req), input) });
}

export async function patchPost(req: Request, res: Response): Promise<void> {
  const input = updatePostSchema.parse(req.body ?? {});
  res.json({ data: await updatePost(uid(req), param(req, 'id'), input) });
}

export async function deletePostHandler(req: Request, res: Response): Promise<void> {
  await deletePost(uid(req), param(req, 'id'));
  res.json({ data: { ok: true } });
}

export async function postPin(req: Request, res: Response): Promise<void> {
  res.json({ data: await togglePin(uid(req), param(req, 'id')) });
}

export async function getComments(req: Request, res: Response): Promise<void> {
  res.json({ data: await listThread(uid(req), param(req, 'id')) });
}

export async function postComment(req: Request, res: Response): Promise<void> {
  const input = createCommentSchema.parse(req.body ?? {});
  res.json({ data: await createComment(uid(req), param(req, 'id'), input) });
}

export async function patchComment(req: Request, res: Response): Promise<void> {
  const input = updateCommentSchema.parse(req.body ?? {});
  res.json({ data: await updateComment(uid(req), param(req, 'id'), input) });
}

export async function deleteCommentHandler(req: Request, res: Response): Promise<void> {
  await deleteComment(uid(req), param(req, 'id'));
  res.json({ data: { ok: true } });
}

export async function getMembers(req: Request, res: Response): Promise<void> {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  res.json({ data: await searchMembers(q) });
}
