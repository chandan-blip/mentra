import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env } from './env.js';
import { logger } from './logger.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { userProfileRouter, userProfilePublicRouter } from './modules/user-profile/index.js';
import { meRouter, adminRouter } from './modules/access/index.js';
import { dashboardRouter } from './modules/dashboard/index.js';
import { roadmapRouter } from './modules/roadmap/index.js';
import { assignmentRouter } from './modules/assignment/index.js';
import { liveSessionRouter, liveSessionWebhookRouter } from './modules/live-session/index.js';
import { mentorRouter } from './modules/mentor/index.js';
import { transactionRouter } from './modules/transaction/index.js';
import { communityRouter } from './modules/community/index.js';
import { notificationRouter } from './modules/notification/index.js';
import { marketingRouter, marketingOauthRouter } from './modules/marketing/index.js';
import { jobsRouter } from './modules/jobs/index.js';
import { leadsRouter, leadsVapiWebhookRouter } from './modules/leads/index.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.NODE_ENV === 'development' ? true : env.WEB_APP_ORIGIN,
      credentials: true,
    }),
  );
  app.use(compression());

  app.use(
    pinoHttp({
      logger,
      customLogLevel(_req, res, err) {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  // The LiveKit webhook is verified by HMAC over the RAW request body, so it must
  // be mounted (with express.raw) BEFORE express.json would consume the stream.
  // It sits after pinoHttp so req.log is available in the handler.
  app.use(
    '/api/v1/live-session/webhook',
    express.raw({ type: '*/*' }),
    liveSessionWebhookRouter,
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  // --- Routes ---
  app.use('/healthz', healthRouter);
  app.use('/readyz', healthRouter);
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  // Public avatar serving (no auth) must be registered before the authed profile
  // router, which gates everything with requireAuth.
  app.use('/api/v1/profile', userProfilePublicRouter);
  app.use('/api/v1/profile', userProfileRouter);
  app.use('/api/v1/me', meRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/dashboard', dashboardRouter);
  app.use('/api/v1/roadmap', roadmapRouter);
  app.use('/api/v1/assignment', assignmentRouter);
  app.use('/api/v1/live-session', liveSessionRouter);
  app.use('/api/v1/mentor', mentorRouter);
  app.use('/api/v1/transaction', transactionRouter);
  app.use('/api/v1/community', communityRouter);
  app.use('/api/v1/notification', notificationRouter);
  app.use('/api/v1/marketing', marketingOauthRouter);
  app.use('/api/v1/marketing', marketingRouter);
  app.use('/api/v1/jobs', jobsRouter);
  // Public Vapi webhook (no auth) must precede the role-gated leads router.
  app.use('/api/v1/leads', leadsVapiWebhookRouter);
  app.use('/api/v1/leads', leadsRouter);

  // --- 404 ---
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
    });
  });

  // --- Error handler ---
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    req.log.error({ err }, 'unhandled error');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
  });

  return app;
}
