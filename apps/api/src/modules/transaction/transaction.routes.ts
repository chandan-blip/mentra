import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireRole } from '../access/access.middleware.js';
import { TransactionError } from './transaction.errors.js';
import { ACCOUNTANT_ROLE } from './transaction.service.js';
import { getTransactions, postReview } from './transaction.controller.js';

export const transactionRouter: Router = Router();

transactionRouter.use(requireAuth);
// Staff-only: the accountant role (admins always pass).
transactionRouter.use(requireRole(ACCOUNTANT_ROLE));

transactionRouter.get('/transactions', asyncHandler(getTransactions));
transactionRouter.post('/transactions/:id/review', asyncHandler(postReview));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }
      if (err instanceof TransactionError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      req.log.error({ err }, 'transaction route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
