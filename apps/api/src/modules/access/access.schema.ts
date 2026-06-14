import { z } from 'zod';

const slug = z.string().trim().min(1).max(191).regex(/^[a-z0-9][a-z0-9._-]*$/i, 'Invalid id');

export const moduleKeyParamSchema = z.object({ key: slug });

export const moduleUpsertSchema = z.object({
  key: slug,
  label: z.string().trim().min(1).max(191),
  description: z.string().trim().max(4000).nullable().default(null),
  icon: z.string().trim().max(64).nullable().default(null),
  route: z.string().trim().max(191).nullable().default(null),
  placement: z.enum(['sidebar', 'other']).default('sidebar'),
  role: slug.max(64).nullable().default(null),
  parentKey: slug.nullable().default(null),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  active: z.boolean().default(true),
});

export const roleUpsertSchema = z.object({
  id: slug,
  label: z.string().trim().min(1).max(191),
  description: z.string().trim().max(500).nullable().default(null),
  isAdmin: z.boolean().default(false),
});

export const rolePermissionSchema = z.object({
  roleId: slug,
  moduleKey: slug,
  canRead: z.boolean(),
  canWrite: z.boolean(),
});

export const planUpsertSchema = z.object({
  id: slug,
  name: z.string().trim().min(1).max(191),
  description: z.string().trim().max(500).nullable().default(null),
  priceCents: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
  // Target role this plan is offered to; null = available to every role.
  roleId: slug.nullable().default(null),
  moduleKeys: z.array(slug).max(200).default([]),
});

export const assignUserSchema = z.object({
  userId: z.string().trim().min(1).max(191),
  roleId: slug.nullable().default(null),
  planId: slug.nullable().default(null),
});
