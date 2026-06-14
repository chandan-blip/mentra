import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from './auth.middleware.js';
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from './auth.schema.js';
import {
  AuthError,
  forgotPassword,
  getMe,
  login,
  logout,
  refresh,
  resetPassword,
  signup,
} from './auth.service.js';

export const authRouter: Router = Router();

authRouter.post('/signup', asyncHandler(async (req, res) => {
  const input = signupSchema.parse(req.body);
  const result = await signup(input, req, res);
  res.status(201).json({ data: result });
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const result = await login(input, req, res);
  res.json({ data: result });
}));

authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const result = await refresh(req, res);
  res.json({ data: result });
}));

authRouter.post('/password/forgot', asyncHandler(async (req, res) => {
  const input = forgotPasswordSchema.parse(req.body);
  const result = await forgotPassword(input);
  res.json({ data: result });
}));

authRouter.post('/password/reset', asyncHandler(async (req, res) => {
  const input = resetPasswordSchema.parse(req.body);
  const result = await resetPassword(input);
  res.json({ data: result });
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await getMe(req.auth!.sub);
  res.json({ data: user });
}));

authRouter.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  await logout(req.auth?.sessionId, res);
  res.status(204).send();
}));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }

      if (err instanceof AuthError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }

      req.log.error({ err }, 'auth route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
