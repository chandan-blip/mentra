import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../access/access.middleware.js';
import { AI_PROMPT_MODULE } from './ai-prompt.service.js';
import { AiPromptError } from './ai-prompt.errors.js';
import { getPrompts, postResetPrompt, putPrompt } from './ai-prompt.controller.js';

/** AI-prompt tuning — role-gated by 'manage-ai-prompts'. Mounted at /api/v1/ai-prompts. */
export const aiPromptRouter: Router = Router();

aiPromptRouter.use(requireAuth);

const read = requirePermission(AI_PROMPT_MODULE, 'read');
const write = requirePermission(AI_PROMPT_MODULE, 'write');

aiPromptRouter.get('/', read, asyncHandler(getPrompts));
aiPromptRouter.put('/:key', write, asyncHandler(putPrompt));
aiPromptRouter.post('/:key/reset', write, asyncHandler(postResetPrompt));

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.flatten() },
        });
        return;
      }
      if (err instanceof AiPromptError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
        return;
      }
      req.log.error({ err }, 'ai-prompt route failed');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    });
  };
}
