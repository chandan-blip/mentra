import { Router, type Request, type Response } from 'express';
import type { HealthResponseZ } from '@mentra/shared';

export const healthRouter: Router = Router();

const startedAt = Date.now();

healthRouter.get('/', (_req: Request, res: Response) => {
  const body: HealthResponseZ = {
    status: 'ok',
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    service: 'mentra-api',
    version: process.env.npm_package_version ?? '0.0.0',
  };
  res.json({ data: body });
});
