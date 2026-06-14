import type { Request, Response } from 'express';
import { reviewTransactionSchema } from '@mentra/shared';
import { listTransactions, reviewTransaction } from './transaction.service.js';

const uid = (req: Request): string => req.auth!.sub;
const param = (req: Request, name: string): string => {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

export async function getTransactions(req: Request, res: Response): Promise<void> {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  res.json({ data: await listTransactions(status) });
}

export async function postReview(req: Request, res: Response): Promise<void> {
  const input = reviewTransactionSchema.parse(req.body ?? {});
  res.json({ data: await reviewTransaction(uid(req), param(req, 'id'), input) });
}
