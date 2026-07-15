import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { CreateLeadInput, LeadStatus, UpdateLeadInput } from '@mentra/shared';
import { db, type SqlParams } from '../../db.js';
import { createId } from '../../core/id.js';

// --- Lead ---

export type LeadRow = {
  id: string;
  ownerId: string;
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
  tags: string[] | string | null;
  lastContactedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const LEAD_COLS =
  '`id`, `ownerId`, `firstName`, `lastName`, `email`, `phone`, `company`, `jobTitle`, `status`, ' +
  '`source`, `value`, `website`, `linkedinUrl`, `city`, `country`, `timezone`, `notes`, `tags`, ' +
  '`lastContactedAt`, `createdAt`, `updatedAt`';

/** Fields an insert/update may set, in DB-column order. `tags` is JSON-stringified. */
const LEAD_WRITABLE = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'company',
  'jobTitle',
  'status',
  'source',
  'value',
  'website',
  'linkedinUrl',
  'city',
  'country',
  'timezone',
  'notes',
  'tags',
] as const;

function leadParam(col: string, value: unknown): SqlParams[string] {
  if (col === 'tags') return JSON.stringify(value ?? []);
  return (value ?? null) as SqlParams[string];
}

export async function insertLead(ownerId: string, input: CreateLeadInput): Promise<LeadRow> {
  const id = createId();
  const cols = ['id', 'ownerId', ...LEAD_WRITABLE];
  const params: SqlParams = { id, ownerId };
  for (const col of LEAD_WRITABLE) params[col] = leadParam(col, (input as Record<string, unknown>)[col]);
  await db.execute<ResultSetHeader>(
    `INSERT INTO \`Lead\` (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (${cols.map((c) => `:${c}`).join(', ')})`,
    params,
  );
  const created = await findLead(ownerId, id);
  if (!created) throw new Error('failed to read back created lead');
  return created;
}

/**
 * Pick the user who should own inbound landing-page enquiries so they surface in a real
 * marketing inbox: a `marketing`-role user first, else a legacy admin, else the earliest
 * account. Returns null only if there are no users at all.
 */
export async function findEnquiryOwnerId(): Promise<string | null> {
  const [rows] = await db.query<({ id: string } & RowDataPacket)[]>(
    'SELECT `id` FROM `User` ' +
      "ORDER BY (`roleId` = 'marketing') DESC, (`role` = 'admin') DESC, `createdAt` ASC LIMIT 1",
  );
  return rows[0]?.id ?? null;
}

export async function findLead(ownerId: string, id: string): Promise<LeadRow | null> {
  const [rows] = await db.execute<(LeadRow & RowDataPacket)[]>(
    `SELECT ${LEAD_COLS} FROM \`Lead\` WHERE \`id\` = :id AND \`ownerId\` = :ownerId LIMIT 1`,
    { id, ownerId },
  );
  return rows[0] ?? null;
}

export async function listLeads(ownerId: string, limit = 500): Promise<LeadRow[]> {
  const [rows] = await db.query<(LeadRow & RowDataPacket)[]>(
    `SELECT ${LEAD_COLS} FROM \`Lead\` WHERE \`ownerId\` = ? ORDER BY \`createdAt\` DESC LIMIT ?`,
    [ownerId, limit],
  );
  return rows;
}

export async function updateLead(ownerId: string, id: string, input: UpdateLeadInput): Promise<void> {
  const entries = Object.entries(input).filter(([col]) => (LEAD_WRITABLE as readonly string[]).includes(col));
  if (entries.length === 0) return;
  const params: SqlParams = { id, ownerId };
  const sets = entries.map(([col, value]) => {
    params[col] = leadParam(col, value);
    return `\`${col}\` = :${col}`;
  });
  await db.execute<ResultSetHeader>(
    `UPDATE \`Lead\` SET ${sets.join(', ')} WHERE \`id\` = :id AND \`ownerId\` = :ownerId`,
    params,
  );
}

export async function markContacted(ownerId: string, leadIds: string[]): Promise<void> {
  if (leadIds.length === 0) return;
  await db.query<ResultSetHeader>(
    'UPDATE `Lead` SET `lastContactedAt` = NOW(3) WHERE `ownerId` = ? AND `id` IN (?)',
    [ownerId, leadIds],
  );
}

export async function deleteLead(ownerId: string, id: string): Promise<number> {
  const [res] = await db.execute<ResultSetHeader>(
    'DELETE FROM `Lead` WHERE `id` = :id AND `ownerId` = :ownerId',
    { id, ownerId },
  );
  // Clean up its list memberships.
  await db.execute<ResultSetHeader>('DELETE FROM `LeadListMember` WHERE `leadId` = :id', { id });
  return res.affectedRows;
}

// --- Lead lists ---

export type LeadListRow = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function insertList(ownerId: string, name: string, description: string | null): Promise<string> {
  const id = createId();
  await db.execute<ResultSetHeader>(
    'INSERT INTO `LeadList` (`id`, `ownerId`, `name`, `description`) VALUES (:id, :ownerId, :name, :description)',
    { id, ownerId, name, description },
  );
  return id;
}

export async function findList(ownerId: string, id: string): Promise<LeadListRow | null> {
  const [rows] = await db.execute<(LeadListRow & RowDataPacket)[]>(
    'SELECT `id`, `ownerId`, `name`, `description`, ' +
      '(SELECT COUNT(*) FROM `LeadListMember` m WHERE m.`listId` = `LeadList`.`id`) AS `memberCount`, ' +
      '`createdAt`, `updatedAt` FROM `LeadList` WHERE `id` = :id AND `ownerId` = :ownerId LIMIT 1',
    { id, ownerId },
  );
  return rows[0] ?? null;
}

export async function listLists(ownerId: string): Promise<LeadListRow[]> {
  const [rows] = await db.execute<(LeadListRow & RowDataPacket)[]>(
    'SELECT `id`, `ownerId`, `name`, `description`, ' +
      '(SELECT COUNT(*) FROM `LeadListMember` m WHERE m.`listId` = `LeadList`.`id`) AS `memberCount`, ' +
      '`createdAt`, `updatedAt` FROM `LeadList` WHERE `ownerId` = :ownerId ORDER BY `createdAt` DESC',
    { ownerId },
  );
  return rows;
}

export async function updateList(
  ownerId: string,
  id: string,
  fields: { name?: string; description?: string | null },
): Promise<void> {
  const sets: string[] = [];
  const params: SqlParams = { id, ownerId };
  if (fields.name !== undefined) {
    sets.push('`name` = :name');
    params.name = fields.name;
  }
  if (fields.description !== undefined) {
    sets.push('`description` = :description');
    params.description = fields.description;
  }
  if (sets.length === 0) return;
  await db.execute<ResultSetHeader>(
    `UPDATE \`LeadList\` SET ${sets.join(', ')} WHERE \`id\` = :id AND \`ownerId\` = :ownerId`,
    params,
  );
}

export async function deleteList(ownerId: string, id: string): Promise<number> {
  const [res] = await db.execute<ResultSetHeader>(
    'DELETE FROM `LeadList` WHERE `id` = :id AND `ownerId` = :ownerId',
    { id, ownerId },
  );
  if (res.affectedRows > 0) {
    await db.execute<ResultSetHeader>('DELETE FROM `LeadListMember` WHERE `listId` = :id', { id });
  }
  return res.affectedRows;
}

// --- List membership ---

/** Add members, ignoring leads that aren't the owner's or are already in the list. */
export async function addMembers(ownerId: string, listId: string, leadIds: string[]): Promise<number> {
  if (leadIds.length === 0) return 0;
  // Only the owner's leads are eligible.
  const [owned] = await db.query<({ id: string } & RowDataPacket)[]>(
    'SELECT `id` FROM `Lead` WHERE `ownerId` = ? AND `id` IN (?)',
    [ownerId, leadIds],
  );
  let added = 0;
  for (const { id: leadId } of owned) {
    const [res] = await db.execute<ResultSetHeader>(
      'INSERT INTO `LeadListMember` (`id`, `listId`, `leadId`) VALUES (:id, :listId, :leadId) ' +
        'ON DUPLICATE KEY UPDATE `id` = `id`',
      { id: createId(), listId, leadId },
    );
    // affectedRows = 1 for a fresh insert, 0 when the dedupe no-op fired.
    if (res.affectedRows === 1) added += 1;
  }
  return added;
}

export async function removeMembers(listId: string, leadIds: string[]): Promise<void> {
  if (leadIds.length === 0) return;
  await db.query<ResultSetHeader>('DELETE FROM `LeadListMember` WHERE `listId` = ? AND `leadId` IN (?)', [
    listId,
    leadIds,
  ]);
}

/** Leads in a list (scoped to the owner via the Lead join). */
export async function listMembers(ownerId: string, listId: string): Promise<LeadRow[]> {
  const [rows] = await db.execute<(LeadRow & RowDataPacket)[]>(
    `SELECT ${LEAD_COLS.split(', ')
      .map((c) => `l.${c}`)
      .join(', ')} FROM \`LeadListMember\` m JOIN \`Lead\` l ON l.\`id\` = m.\`leadId\` ` +
      'WHERE m.`listId` = :listId AND l.`ownerId` = :ownerId ORDER BY m.`addedAt` DESC',
    { listId, ownerId },
  );
  return rows;
}

// --- Calls ---

export type LeadCallRow = {
  id: string;
  ownerId: string;
  leadId: string;
  listId: string | null;
  vapiCallId: string | null;
  status: string;
  endedReason: string | null;
  summary: string | null;
  recordingUrl: string | null;
  createdAt: Date;
};

const CALL_COLS =
  '`id`, `ownerId`, `leadId`, `listId`, `vapiCallId`, `status`, `endedReason`, `summary`, `recordingUrl`, `createdAt`';

export async function insertCall(input: {
  ownerId: string;
  leadId: string;
  listId: string | null;
  vapiCallId: string | null;
  status: string;
}): Promise<string> {
  const id = createId();
  await db.execute<ResultSetHeader>(
    'INSERT INTO `LeadCall` (`id`, `ownerId`, `leadId`, `listId`, `vapiCallId`, `status`) ' +
      'VALUES (:id, :ownerId, :leadId, :listId, :vapiCallId, :status)',
    { id, ownerId: input.ownerId, leadId: input.leadId, listId: input.listId, vapiCallId: input.vapiCallId, status: input.status },
  );
  return id;
}

export async function listCalls(
  ownerId: string,
  opts: { listId?: string; leadId?: string } = {},
  limit = 200,
): Promise<(LeadCallRow & { leadName: string })[]> {
  const params: SqlParams = { ownerId, limit };
  const conds = ['c.`ownerId` = :ownerId'];
  if (opts.listId) {
    conds.push('c.`listId` = :listId');
    params.listId = opts.listId;
  }
  if (opts.leadId) {
    conds.push('c.`leadId` = :leadId');
    params.leadId = opts.leadId;
  }
  const where = conds.join(' AND ');
  const [rows] = await db.query<((LeadCallRow & { leadName: string }) & RowDataPacket)[]>(
    `SELECT ${CALL_COLS.split(', ')
      .map((c) => `c.${c}`)
      .join(', ')}, TRIM(CONCAT(COALESCE(l.\`firstName\`, ''), ' ', COALESCE(l.\`lastName\`, ''))) AS \`leadName\` ` +
      `FROM \`LeadCall\` c LEFT JOIN \`Lead\` l ON l.\`id\` = c.\`leadId\` WHERE ${where} ` +
      'ORDER BY c.`createdAt` DESC LIMIT :limit',
    params,
  );
  return rows;
}

/** Webhook: update a call by its Vapi id. Returns false if no matching call. */
export async function updateCallByVapiId(
  vapiCallId: string,
  fields: {
    status?: string;
    endedReason?: string | null;
    summary?: string | null;
    transcript?: string | null;
    recordingUrl?: string | null;
    startedAt?: Date | null;
    endedAt?: Date | null;
  },
): Promise<boolean> {
  const sets: string[] = [];
  const params: SqlParams = { vapiCallId };
  for (const [col, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    sets.push(`\`${col}\` = :${col}`);
    params[col] = (value ?? null) as SqlParams[string];
  }
  if (sets.length === 0) return false;
  const [res] = await db.execute<ResultSetHeader>(
    `UPDATE \`LeadCall\` SET ${sets.join(', ')} WHERE \`vapiCallId\` = :vapiCallId`,
    params,
  );
  return res.affectedRows > 0;
}
