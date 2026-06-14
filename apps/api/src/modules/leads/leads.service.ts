import type {
  CallRunResult,
  CreateLeadInput,
  CreateLeadListInput,
  LeadCallStatus,
  LeadCallView,
  LeadListView,
  LeadStatus,
  LeadView,
  SendListEmailInput,
  StartCallRunInput,
  UpdateLeadInput,
  UpdateLeadListInput,
} from '@mentra/shared';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { LeadError } from './leads.errors.js';
import { createCall, mapVapiStatus, missingVapiVars, VapiError } from './vapi.js';
import * as repo from './leads.repository.js';

/** Marketing role gates every lead route (see leads.routes). */
export const MARKETING_ROLE = 'marketing';

const iso = (d: Date): string => new Date(d).toISOString();
const isoN = (d: Date | null): string | null => (d ? new Date(d).toISOString() : null);

function normalizeTags(value: string[] | string | null): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const p = JSON.parse(value);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toLeadView(row: repo.LeadRow): LeadView {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    company: row.company,
    jobTitle: row.jobTitle,
    status: row.status as LeadStatus,
    source: row.source,
    value: row.value,
    website: row.website,
    linkedinUrl: row.linkedinUrl,
    city: row.city,
    country: row.country,
    timezone: row.timezone,
    notes: row.notes,
    tags: normalizeTags(row.tags),
    lastContactedAt: isoN(row.lastContactedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function toListView(row: repo.LeadListRow): LeadListView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    memberCount: Number(row.memberCount),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function toCallView(row: repo.LeadCallRow & { leadName: string }): LeadCallView {
  return {
    id: row.id,
    leadId: row.leadId,
    leadName: row.leadName?.trim() || 'Lead',
    listId: row.listId,
    status: row.status as LeadCallStatus,
    endedReason: row.endedReason,
    summary: row.summary,
    recordingUrl: row.recordingUrl,
    createdAt: iso(row.createdAt),
  };
}

// --- Leads CRUD ---

export async function listLeads(ownerId: string): Promise<LeadView[]> {
  return (await repo.listLeads(ownerId)).map(toLeadView);
}

export async function getLead(ownerId: string, id: string): Promise<LeadView> {
  const lead = await repo.findLead(ownerId, id);
  if (!lead) throw new LeadError('LEAD_NOT_FOUND', 'Lead not found', 404);
  return toLeadView(lead);
}

export async function createLead(ownerId: string, input: CreateLeadInput): Promise<LeadView> {
  return toLeadView(await repo.insertLead(ownerId, input));
}

export async function updateLead(ownerId: string, id: string, input: UpdateLeadInput): Promise<LeadView> {
  const existing = await repo.findLead(ownerId, id);
  if (!existing) throw new LeadError('LEAD_NOT_FOUND', 'Lead not found', 404);
  await repo.updateLead(ownerId, id, input);
  const updated = await repo.findLead(ownerId, id);
  return toLeadView(updated!);
}

export async function deleteLead(ownerId: string, id: string): Promise<void> {
  const deleted = await repo.deleteLead(ownerId, id);
  if (deleted === 0) throw new LeadError('LEAD_NOT_FOUND', 'Lead not found', 404);
}

// --- Lists ---

export async function listLists(ownerId: string): Promise<LeadListView[]> {
  return (await repo.listLists(ownerId)).map(toListView);
}

export async function createList(ownerId: string, input: CreateLeadListInput): Promise<LeadListView> {
  const id = await repo.insertList(ownerId, input.name, input.description ?? null);
  const row = await repo.findList(ownerId, id);
  return toListView(row!);
}

export async function updateList(ownerId: string, id: string, input: UpdateLeadListInput): Promise<LeadListView> {
  const existing = await repo.findList(ownerId, id);
  if (!existing) throw new LeadError('LIST_NOT_FOUND', 'List not found', 404);
  await repo.updateList(ownerId, id, { name: input.name, description: input.description ?? undefined });
  const row = await repo.findList(ownerId, id);
  return toListView(row!);
}

export async function deleteList(ownerId: string, id: string): Promise<void> {
  const deleted = await repo.deleteList(ownerId, id);
  if (deleted === 0) throw new LeadError('LIST_NOT_FOUND', 'List not found', 404);
}

async function assertList(ownerId: string, listId: string): Promise<repo.LeadListRow> {
  const list = await repo.findList(ownerId, listId);
  if (!list) throw new LeadError('LIST_NOT_FOUND', 'List not found', 404);
  return list;
}

export async function addToList(ownerId: string, listId: string, leadIds: string[]): Promise<LeadListView> {
  await assertList(ownerId, listId);
  await repo.addMembers(ownerId, listId, leadIds);
  return toListView((await repo.findList(ownerId, listId))!);
}

export async function removeFromList(ownerId: string, listId: string, leadIds: string[]): Promise<LeadListView> {
  await assertList(ownerId, listId);
  await repo.removeMembers(listId, leadIds);
  return toListView((await repo.findList(ownerId, listId))!);
}

export async function listMembers(ownerId: string, listId: string): Promise<LeadView[]> {
  await assertList(ownerId, listId);
  return (await repo.listMembers(ownerId, listId)).map(toLeadView);
}

// --- AI calling (Vapi) ---

export async function startCallRun(
  ownerId: string,
  listId: string,
  input: StartCallRunInput,
): Promise<CallRunResult> {
  const missing = missingVapiVars();
  if (missing.length) {
    throw new LeadError('VAPI_NOT_CONFIGURED', `AI calling is not configured — missing env: ${missing.join(', ')}.`, 503);
  }
  await assertList(ownerId, listId);
  const members = await repo.listMembers(ownerId, listId);

  const withPhone = members.filter((m) => m.phone && m.phone.trim());
  const skippedNoPhone = members.length - withPhone.length;
  const cap = env.VAPI_MAX_CALLS_PER_RUN;
  const toDial = withPhone.slice(0, cap);
  const skippedCap = withPhone.length - toDial.length;

  const assistantId = input.assistantId?.trim() || env.VAPI_ASSISTANT_ID;
  let queued = 0;
  const dialed: string[] = [];

  for (const lead of toDial) {
    try {
      const call = await createCall({
        assistantId,
        phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
        number: lead.phone!.trim(),
        name: [lead.firstName, lead.lastName].filter(Boolean).join(' ') || undefined,
        metadata: { leadId: lead.id, listId },
      });
      await repo.insertCall({ ownerId, leadId: lead.id, listId, vapiCallId: call.id, status: mapVapiStatus(call.status) });
      dialed.push(lead.id);
      queued += 1;
    } catch (err) {
      // Record the failure so the operator sees which leads didn't dial, then continue.
      logger.error({ err, leadId: lead.id }, 'leads.vapi.call_failed');
      await repo.insertCall({ ownerId, leadId: lead.id, listId, vapiCallId: null, status: 'failed' });
      if (!(err instanceof VapiError)) throw err;
    }
  }

  await repo.markContacted(ownerId, dialed);
  return { queued, skippedNoPhone, skippedCap };
}

export async function listCalls(
  ownerId: string,
  opts: { listId?: string; leadId?: string } = {},
): Promise<LeadCallView[]> {
  return (await repo.listCalls(ownerId, opts)).map(toCallView);
}

/** Place a single AI call to one lead (not tied to a list). */
export async function callLead(ownerId: string, leadId: string, input: StartCallRunInput): Promise<LeadCallView> {
  const missing = missingVapiVars();
  if (missing.length) {
    throw new LeadError('VAPI_NOT_CONFIGURED', `AI calling is not configured — missing env: ${missing.join(', ')}.`, 503);
  }
  const lead = await repo.findLead(ownerId, leadId);
  if (!lead) throw new LeadError('LEAD_NOT_FOUND', 'Lead not found', 404);
  if (!lead.phone || !lead.phone.trim()) {
    throw new LeadError('LEAD_NO_PHONE', 'This lead has no phone number to call.', 400);
  }

  const assistantId = input.assistantId?.trim() || env.VAPI_ASSISTANT_ID;
  let vapiCallId: string | null = null;
  let status = 'failed';
  let failReason = '';
  try {
    const call = await createCall({
      assistantId,
      phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
      number: lead.phone.trim(),
      name: [lead.firstName, lead.lastName].filter(Boolean).join(' ') || undefined,
      metadata: { leadId: lead.id },
    });
    vapiCallId = call.id;
    status = mapVapiStatus(call.status);
  } catch (err) {
    logger.error({ err, leadId: lead.id }, 'leads.vapi.call_failed');
    if (err instanceof VapiError) failReason = err.message;
    else throw err;
  }

  const callId = await repo.insertCall({ ownerId, leadId: lead.id, listId: null, vapiCallId, status });
  if (vapiCallId) await repo.markContacted(ownerId, [lead.id]);
  if (status === 'failed') {
    throw new LeadError('VAPI_CALL_FAILED', failReason || 'Could not place the call. Check the number and your Vapi setup.', 502);
  }
  const rows = await repo.listCalls(ownerId, { leadId: lead.id });
  return toCallView(rows.find((r) => r.id === callId) ?? rows[0]!);
}

// --- Email outreach (recorded action) ---

/**
 * Logs an email blast against a list by marking its emailable members contacted.
 * NOTE: the platform has no email transport wired yet, so this records the outreach
 * (lastContactedAt) and returns the recipient count rather than delivering mail. Wire
 * an email provider here to actually send.
 */
export async function sendListEmail(
  ownerId: string,
  listId: string,
  _input: SendListEmailInput,
): Promise<{ recipients: number }> {
  await assertList(ownerId, listId);
  const members = await repo.listMembers(ownerId, listId);
  const withEmail = members.filter((m) => m.email && m.email.trim());
  await repo.markContacted(ownerId, withEmail.map((m) => m.id));
  return { recipients: withEmail.length };
}

// --- Vapi webhook ---

type VapiWebhookBody = {
  message?: {
    type?: string;
    status?: string;
    endedReason?: string;
    summary?: string;
    transcript?: string;
    recordingUrl?: string;
    call?: { id?: string; status?: string };
    artifact?: { recordingUrl?: string; transcript?: string };
    analysis?: { summary?: string };
  };
};

export async function handleVapiWebhook(body: VapiWebhookBody): Promise<void> {
  const message = body?.message;
  const vapiCallId = message?.call?.id;
  if (!message || !vapiCallId) return;

  if (message.type === 'end-of-call-report') {
    await repo.updateCallByVapiId(vapiCallId, {
      status: 'ended',
      endedReason: message.endedReason ?? null,
      summary: message.summary ?? message.analysis?.summary ?? null,
      transcript: message.transcript ?? message.artifact?.transcript ?? null,
      recordingUrl: message.recordingUrl ?? message.artifact?.recordingUrl ?? null,
      endedAt: new Date(),
    });
    return;
  }

  if (message.type === 'status-update') {
    const status = mapVapiStatus(message.status ?? message.call?.status);
    await repo.updateCallByVapiId(vapiCallId, {
      status,
      ...(status === 'in-progress' ? { startedAt: new Date() } : {}),
      ...(status === 'ended' ? { endedAt: new Date() } : {}),
    });
  }
}
