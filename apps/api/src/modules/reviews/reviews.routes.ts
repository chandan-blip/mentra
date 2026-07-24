import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../access/access.middleware.js';
import { ReviewError } from './reviews.errors.js';
import {
  deleteReviewById,
  getAllReviews,
  getPublishedReviews,
  patchReview,
  postCreateReview,
  postFinalizeReview,
} from './reviews.controller.js';

/** Student-facing gallery — read-only, gated by the 'reviews' module. Mounted at /api/v1/reviews. */
export const reviewsRouter: Router = Router();
reviewsRouter.use(requireAuth);
reviewsRouter.get('/', requirePermission('reviews', 'read'), asyncHandler(getPublishedReviews));

/**
 * Manager surface — upload/manage student reviews, gated by 'manage-reviews'.
 * Mounted at /api/v1/manage-reviews.
 */
export const reviewsAdminRouter: Router = Router();
reviewsAdminRouter.use(requireAuth);
const read = requirePermission('manage-reviews', 'read');
const write = requirePermission('manage-reviews', 'write');
reviewsAdminRouter.get('/', read, asyncHandler(getAllReviews));
reviewsAdminRouter.post('/', write, asyncHandler(postCreateReview));
reviewsAdminRouter.post('/:id/finalize', write, asyncHandler(postFinalizeReview));
reviewsAdminRouter.patch('/:id', write, asyncHandler(patchReview));
reviewsAdminRouter.delete('/:id', write, asyncHandler(deleteReviewById));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }
      if (err instanceof ReviewError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      req.log.error({ err }, 'reviews route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
