import { z } from 'zod';

export const ackSchema = z.object({
  action: z.enum(['clicked', 'dismissed']),
});
