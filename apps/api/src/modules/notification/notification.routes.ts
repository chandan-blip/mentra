import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { getNotifications, getUnreadCount, postRead, postReadAll } from './notification.controller.js';

export const notificationRouter: Router = Router();

notificationRouter.use(requireAuth);

notificationRouter.get('/', asyncHandler(getNotifications));
notificationRouter.get('/unread-count', asyncHandler(getUnreadCount));
notificationRouter.post('/:id/read', asyncHandler(postRead));
notificationRouter.post('/read-all', asyncHandler(postReadAll));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      req.log.error({ err }, 'notification route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
