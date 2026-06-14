import { z } from 'zod';

/**
 * Transactions — payments for paid mentor bookings. A booking checkout creates a
 * `pending` transaction; an accountant reviews it (approve/reject) and may refund.
 * Contract for the REST surface under /api/v1/transaction (accountant-gated).
 */

export type TransactionStatus = 'pending' | 'approved' | 'rejected' | 'refunded';

/** Accountant action on a transaction. */
export const reviewTransactionSchema = z.object({
  action: z.enum(['approve', 'reject', 'refund']),
  note: z.string().trim().max(500).optional(),
});
export type ReviewTransactionInput = z.infer<typeof reviewTransactionSchema>;

export type TransactionView = {
  id: string;
  kind: string;
  bookingId: string;
  studentId: string;
  studentName: string;
  mentorId: string;
  mentorName: string;
  amountCents: number;
  currency: string;
  status: TransactionStatus;
  note: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  /** Booking context shown to the accountant. */
  booking: {
    topic: string;
    kind: 'one_to_one' | 'group';
    access: 'paid' | 'casual';
    startsAt: string;
    status: string;
    feedbackScore: number | null;
    feedbackComment: string | null;
  } | null;
};
