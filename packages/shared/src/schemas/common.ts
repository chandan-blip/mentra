import { z } from 'zod';

export const RoleSchema = z.enum(['student', 'mentor', 'admin']);
export type RoleZ = z.infer<typeof RoleSchema>;

export const UserStatusSchema = z.enum(['pending', 'active', 'suspended']);
export type UserStatusZ = z.infer<typeof UserStatusSchema>;

export const AuthProviderSchema = z.enum(['email', 'google', 'github']);
export type AuthProviderZ = z.infer<typeof AuthProviderSchema>;

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  uptime: z.number(),
  service: z.literal('mentra-api'),
  version: z.string(),
});
export type HealthResponseZ = z.infer<typeof HealthResponseSchema>;
