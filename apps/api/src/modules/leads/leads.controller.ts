import type { Request, Response } from 'express';
import {
  createLeadListSchema,
  createLeadSchema,
  listMembersSchema,
  sendListEmailSchema,
  startCallRunSchema,
  updateLeadListSchema,
  updateLeadSchema,
} from '@mentra/shared';
import * as svc from './leads.service.js';

const uid = (req: Request): string => req.auth!.sub;
const param = (req: Request, key: string): string => {
  const v = req.params[key];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
};

// --- Leads ---

export async function getLeads(req: Request, res: Response): Promise<void> {
  res.json({ data: await svc.listLeads(uid(req)) });
}

export async function getLead(req: Request, res: Response): Promise<void> {
  res.json({ data: await svc.getLead(uid(req), param(req, 'id')) });
}

export async function postLeadCall(req: Request, res: Response): Promise<void> {
  res.json({ data: await svc.callLead(uid(req), param(req, 'id'), startCallRunSchema.parse(req.body ?? {})) });
}

export async function postLead(req: Request, res: Response): Promise<void> {
  res.json({ data: await svc.createLead(uid(req), createLeadSchema.parse(req.body ?? {})) });
}

export async function patchLead(req: Request, res: Response): Promise<void> {
  res.json({ data: await svc.updateLead(uid(req), param(req, 'id'), updateLeadSchema.parse(req.body ?? {})) });
}

export async function deleteLeadHandler(req: Request, res: Response): Promise<void> {
  await svc.deleteLead(uid(req), param(req, 'id'));
  res.json({ data: { ok: true } });
}

// --- Lists ---

export async function getLists(req: Request, res: Response): Promise<void> {
  res.json({ data: await svc.listLists(uid(req)) });
}

export async function postList(req: Request, res: Response): Promise<void> {
  res.json({ data: await svc.createList(uid(req), createLeadListSchema.parse(req.body ?? {})) });
}

export async function patchList(req: Request, res: Response): Promise<void> {
  res.json({ data: await svc.updateList(uid(req), param(req, 'id'), updateLeadListSchema.parse(req.body ?? {})) });
}

export async function deleteListHandler(req: Request, res: Response): Promise<void> {
  await svc.deleteList(uid(req), param(req, 'id'));
  res.json({ data: { ok: true } });
}

export async function getListMembers(req: Request, res: Response): Promise<void> {
  res.json({ data: await svc.listMembers(uid(req), param(req, 'id')) });
}

export async function postAddMembers(req: Request, res: Response): Promise<void> {
  const { leadIds } = listMembersSchema.parse(req.body ?? {});
  res.json({ data: await svc.addToList(uid(req), param(req, 'id'), leadIds) });
}

export async function postRemoveMembers(req: Request, res: Response): Promise<void> {
  const { leadIds } = listMembersSchema.parse(req.body ?? {});
  res.json({ data: await svc.removeFromList(uid(req), param(req, 'id'), leadIds) });
}

// --- Actions ---

export async function postStartCall(req: Request, res: Response): Promise<void> {
  res.json({ data: await svc.startCallRun(uid(req), param(req, 'id'), startCallRunSchema.parse(req.body ?? {})) });
}

export async function postSendEmail(req: Request, res: Response): Promise<void> {
  res.json({ data: await svc.sendListEmail(uid(req), param(req, 'id'), sendListEmailSchema.parse(req.body ?? {})) });
}

export async function getCalls(req: Request, res: Response): Promise<void> {
  const listId = typeof req.query.listId === 'string' ? req.query.listId : undefined;
  const leadId = typeof req.query.leadId === 'string' ? req.query.leadId : undefined;
  res.json({ data: await svc.listCalls(uid(req), { listId, leadId }) });
}
