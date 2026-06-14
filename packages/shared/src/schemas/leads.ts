import { z } from 'zod';

/**
 * Leads CRM for the marketing role: leads (full contact + deal profile), lists
 * (segments used for bulk actions), and AI phone calls placed via Vapi against the
 * leads in a list. These schemas are the FE+BE contract.
 */

export const LeadStatusSchema = z.enum(['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']);
export type LeadStatus = z.infer<typeof LeadStatusSchema>;

const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(30).default([]);

// All optional except nothing is strictly required — a lead may start as just a phone
// number or just a name. Empty strings are coerced to null on the server.
export const createLeadSchema = z.object({
  firstName: z.string().trim().max(120).nullable().optional(),
  lastName: z.string().trim().max(120).nullable().optional(),
  email: z.string().trim().max(255).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  company: z.string().trim().max(200).nullable().optional(),
  jobTitle: z.string().trim().max(160).nullable().optional(),
  status: LeadStatusSchema.default('new'),
  source: z.string().trim().max(40).nullable().optional(),
  value: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  website: z.string().trim().max(500).nullable().optional(),
  linkedinUrl: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(120).nullable().optional(),
  timezone: z.string().trim().max(64).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  tags: tagsSchema,
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = createLeadSchema.partial();
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

// --- Lists ---

export const createLeadListSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).nullable().optional(),
});
export type CreateLeadListInput = z.infer<typeof createLeadListSchema>;

export const updateLeadListSchema = createLeadListSchema.partial();
export type UpdateLeadListInput = z.infer<typeof updateLeadListSchema>;

/** Add/remove a set of leads to/from a list. */
export const listMembersSchema = z.object({
  leadIds: z.array(z.string().trim().min(1).max(191)).min(1).max(1000),
});
export type ListMembersInput = z.infer<typeof listMembersSchema>;

// --- Actions ---

/** Start an AI calling run against every callable lead in a list. */
export const startCallRunSchema = z.object({
  /** Override the default Vapi assistant for this run (optional). */
  assistantId: z.string().trim().max(191).optional(),
});
export type StartCallRunInput = z.infer<typeof startCallRunSchema>;

/** Record an email blast to a list (recorded action — see service notes). */
export const sendListEmailSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
});
export type SendListEmailInput = z.infer<typeof sendListEmailSchema>;

// --- Views ---

export type LeadView = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  status: LeadStatus;
  source: string | null;
  value: number | null;
  website: string | null;
  linkedinUrl: string | null;
  city: string | null;
  country: string | null;
  timezone: string | null;
  notes: string | null;
  tags: string[];
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadListView = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type LeadCallStatus = 'queued' | 'ringing' | 'in-progress' | 'ended' | 'failed';

export type LeadCallView = {
  id: string;
  leadId: string;
  leadName: string;
  listId: string | null;
  status: LeadCallStatus;
  endedReason: string | null;
  summary: string | null;
  recordingUrl: string | null;
  createdAt: string;
};

/** Result of kicking off a list call run. */
export type CallRunResult = {
  /** Calls successfully queued at Vapi. */
  queued: number;
  /** Leads skipped because they had no phone number. */
  skippedNoPhone: number;
  /** Leads beyond the per-run cap that were not dialed. */
  skippedCap: number;
};
