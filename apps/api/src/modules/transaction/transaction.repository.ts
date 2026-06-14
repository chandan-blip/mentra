import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../../db.js';
import { createId } from '../../core/id.js';

/**
 * Data access for payment transactions tied to mentor bookings. No FK constraints —
 * related ids are plain columns. Shared by the mentor module (creates a pending
 * transaction at checkout) and the transaction module (accountant review).
 */

export type TransactionRow = {
  id: string;
  kind: string;
  bookingId: string;
  studentId: string;
  mentorId: string;
  amountCents: number;
  currency: string;
  status: string;
  gatewayRef: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const COLS =
  '`id`, `kind`, `bookingId`, `studentId`, `mentorId`, `amountCents`, `currency`, `status`, `gatewayRef`, `reviewedBy`, `reviewedAt`, `note`, `createdAt`, `updatedAt`';

export async function createTransaction(input: {
  bookingId: string;
  studentId: string;
  mentorId: string;
  amountCents: number;
  currency?: string;
}): Promise<TransactionRow> {
  const id = createId();
  await db.execute<ResultSetHeader>(
    'INSERT INTO `Transaction` (`id`, `bookingId`, `studentId`, `mentorId`, `amountCents`, `currency`) ' +
      'VALUES (:id, :bookingId, :studentId, :mentorId, :amountCents, :currency)',
    {
      id,
      bookingId: input.bookingId,
      studentId: input.studentId,
      mentorId: input.mentorId,
      amountCents: input.amountCents,
      currency: input.currency ?? 'INR',
    },
  );
  const created = await findById(id);
  if (!created) throw new Error('failed to read back created transaction');
  return created;
}

export async function findById(id: string): Promise<TransactionRow | null> {
  const [rows] = await db.execute<(TransactionRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`Transaction\` WHERE \`id\` = :id LIMIT 1`,
    { id },
  );
  return rows[0] ?? null;
}

export async function listByStatus(status?: string): Promise<TransactionRow[]> {
  if (status) {
    const [rows] = await db.execute<(TransactionRow & RowDataPacket)[]>(
      `SELECT ${COLS} FROM \`Transaction\` WHERE \`status\` = :status ORDER BY \`createdAt\` DESC`,
      { status },
    );
    return rows;
  }
  const [rows] = await db.execute<(TransactionRow & RowDataPacket)[]>(
    `SELECT ${COLS} FROM \`Transaction\` ORDER BY \`createdAt\` DESC`,
  );
  return rows;
}

/** Payment status per bookingId — for showing paymentStatus on booking views. */
export async function statusByBookingIds(bookingIds: string[]): Promise<Map<string, string>> {
  if (bookingIds.length === 0) return new Map();
  const [rows] = await db.query<({ bookingId: string; status: string } & RowDataPacket)[]>(
    'SELECT `bookingId`, `status` FROM `Transaction` WHERE `bookingId` IN (?)',
    [bookingIds],
  );
  return new Map(rows.map((r) => [r.bookingId, r.status]));
}

export async function setStatus(
  id: string,
  status: 'pending' | 'approved' | 'rejected' | 'refunded',
  reviewedBy: string,
  note: string | null,
): Promise<void> {
  await db.execute<ResultSetHeader>(
    'UPDATE `Transaction` SET `status` = :status, `reviewedBy` = :reviewedBy, `reviewedAt` = NOW(3), `note` = :note WHERE `id` = :id',
    { id, status, reviewedBy, note },
  );
}
