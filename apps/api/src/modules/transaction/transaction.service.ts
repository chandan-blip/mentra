import type { ReviewTransactionInput, TransactionStatus, TransactionView } from '@mentra/shared';
import * as mentorRepo from '../mentor/mentor.repository.js';
import { confirmBookingPaid, rejectBooking } from '../mentor/mentor.service.js';
import { createNotification } from '../notification/notification.service.js';
import { TransactionError } from './transaction.errors.js';
import * as repo from './transaction.repository.js';

/**
 * Accountant-facing payment review. A paid booking checkout creates a `pending`
 * transaction; the accountant approves (→ booking confirmed + join code), rejects
 * (→ booking rejected, seat freed), or refunds (→ refunded). Feedback on the linked
 * booking is surfaced as context for the refund decision.
 */

export const ACCOUNTANT_ROLE = 'accountant';

async function toView(row: repo.TransactionRow): Promise<TransactionView> {
  const [names, booking] = await Promise.all([
    mentorRepo.findUserNames([row.studentId, row.mentorId]),
    mentorRepo.findBookingById(row.bookingId),
  ]);
  return {
    id: row.id,
    kind: row.kind,
    bookingId: row.bookingId,
    studentId: row.studentId,
    studentName: names.get(row.studentId) ?? 'Student',
    mentorId: row.mentorId,
    mentorName: names.get(row.mentorId) ?? 'Mentor',
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status as TransactionStatus,
    note: row.note,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    booking: booking
      ? {
          topic: booking.topic,
          kind: booking.slotKind as 'one_to_one' | 'group',
          access: booking.slotAccess as 'paid' | 'casual',
          startsAt: booking.startsAt.toISOString(),
          status: booking.status,
          feedbackScore: booking.feedbackScore,
          feedbackComment: booking.feedbackComment,
        }
      : null,
  };
}

export async function listTransactions(status?: string): Promise<TransactionView[]> {
  const rows = await repo.listByStatus(status);
  return Promise.all(rows.map(toView));
}

export async function reviewTransaction(
  accountantId: string,
  txnId: string,
  input: ReviewTransactionInput,
): Promise<TransactionView> {
  const txn = await repo.findById(txnId);
  if (!txn) throw new TransactionError('TXN_NOT_FOUND', 'Transaction not found', 404);
  const note = input.note ?? null;

  if (input.action === 'approve') {
    if (txn.status !== 'pending') throw new TransactionError('TXN_NOT_PENDING', 'Only pending payments can be approved', 409);
    await repo.setStatus(txnId, 'approved', accountantId, note);
    await confirmBookingPaid(txn.bookingId);
    // confirmBookingPaid already notifies the student with their join code.
  } else if (input.action === 'reject') {
    if (txn.status !== 'pending') throw new TransactionError('TXN_NOT_PENDING', 'Only pending payments can be rejected', 409);
    await repo.setStatus(txnId, 'rejected', accountantId, note);
    await rejectBooking(txn.bookingId);
    await createNotification({
      userId: txn.studentId,
      type: 'payment.rejected',
      title: 'Payment not approved',
      body: note ?? 'Your booking payment was rejected.',
      link: '/mentors',
      moduleKey: 'mentors',
    });
  } else {
    // refund
    if (txn.status !== 'approved') throw new TransactionError('TXN_NOT_REFUNDABLE', 'Only approved payments can be refunded', 409);
    await repo.setStatus(txnId, 'refunded', accountantId, note);
    await createNotification({
      userId: txn.studentId,
      type: 'payment.refunded',
      title: 'Refund issued',
      body: note ?? 'Your session payment has been refunded.',
      link: '/mentors',
      moduleKey: 'mentors',
    });
  }

  const updated = await repo.findById(txnId);
  return toView(updated!);
}
