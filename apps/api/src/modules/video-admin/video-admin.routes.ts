import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../access/access.middleware.js';
import { LiveSessionError } from '../live-session/live-session.errors.js';
import {
  getVideos,
  patchVideo,
  postPublic,
  postRegenerateThumbnail,
  postThumbnailFinalize,
  postThumbnailUpload,
  postVisibility,
  removeVideo,
} from './video-admin.controller.js';

/** Videos-management module — role-gated by 'manage-videos'. Mounted at /api/v1/videos. */
export const videoAdminRouter: Router = Router();

videoAdminRouter.use(requireAuth);

const read = requirePermission('manage-videos', 'read');
const write = requirePermission('manage-videos', 'write');

videoAdminRouter.get('/', read, asyncHandler(getVideos));
videoAdminRouter.patch('/:id', write, asyncHandler(patchVideo));
videoAdminRouter.post('/:id/visibility', write, asyncHandler(postVisibility));
videoAdminRouter.post('/:id/public', write, asyncHandler(postPublic));
videoAdminRouter.delete('/:id', write, asyncHandler(removeVideo));
videoAdminRouter.post('/:id/thumbnail/regenerate', write, asyncHandler(postRegenerateThumbnail));
videoAdminRouter.post('/:id/thumbnail/upload', write, asyncHandler(postThumbnailUpload));
videoAdminRouter.post('/:id/thumbnail/finalize', write, asyncHandler(postThumbnailFinalize));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }
      if (err instanceof LiveSessionError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      req.log.error({ err }, 'video-admin route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
