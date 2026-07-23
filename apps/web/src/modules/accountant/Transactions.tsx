import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Check, RotateCcw, X } from 'lucide-react';
import { Badge, Card } from '@mentra/ui';
import type { TransactionStatus, TransactionView } from '@mentra/shared';
import { useMyAccess } from '../../lib/access.js';
import { formatPrice, formatSlot, hueOf, avatarBg } from '../../lib/mentors.js';
import { StarRating } from '../../components/StarRating.js';
import { useReviewTransaction, useTransactions } from '../../lib/transactions.js';

/**
 * Accountant — review payments for mentor bookings. Approve a pending payment to
 * confirm the booking (student gets a join code), reject to free the seat, or refund
 * an approved payment (feedback shown as context for the decision).
 */

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

type Tab = Extract<TransactionStatus, 'pending' | 'approved' | 'refunded'>;

export function TransactionsPage() {
  const { data: access } = useMyAccess();
  const allowed = access?.roleId === 'accountant' || access?.isAdmin === true;
  const [tab, setTab] = useState<Tab>('pending');

  if (!allowed) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Card>
          <div className="text-sm font-medium text-ink">Accountants only</div>
          <p className="mt-1 text-sm leading-6 text-ink-muted">This area is for reviewing booking payments.</p>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto w-full max-w-4xl space-y-5"
    >
      <motion.div variants={fadeUp} className="flex gap-1 rounded-lg bg-surface-sunken p-1">
        <TabButton active={tab === 'pending'} onClick={() => setTab('pending')}>Pending</TabButton>
        <TabButton active={tab === 'approved'} onClick={() => setTab('approved')}>Approved</TabButton>
        <TabButton active={tab === 'refunded'} onClick={() => setTab('refunded')}>Refunded</TabButton>
      </motion.div>

      <TxnList tab={tab} />
    </motion.div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 flex-1 rounded-md text-sm font-medium transition ${
        active ? 'bg-surface-raised text-ink shadow-sm ring-1 ring-border-subtle' : 'text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function TxnList({ tab }: { tab: Tab }) {
  const txns = useTransactions(tab);
  const review = useReviewTransaction();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: 'approve' | 'reject' | 'refund') {
    setBusy(id);
    try {
      await review.mutateAsync({ id, input: { action } });
    } finally {
      setBusy(null);
    }
  }

  if (txns.isLoading) return <Card className="text-sm text-ink-muted">Loading…</Card>;
  const data = txns.data ?? [];
  if (data.length === 0) return <Card className="text-sm text-ink-muted">Nothing here.</Card>;

  return (
    <motion.div variants={fadeUp}>
      <Card className="divide-y divide-border-subtle p-0">
        {data.map((t) => (
          <TxnRow key={t.id} txn={t} busy={busy === t.id} onAct={(a) => act(t.id, a)} />
        ))}
      </Card>
    </motion.div>
  );
}

function TxnRow({ txn: t, busy, onAct }: { txn: TransactionView; busy: boolean; onAct: (a: 'approve' | 'reject' | 'refund') => void }) {
  return (
    <div className="flex flex-wrap items-start gap-3 px-4 py-3">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: avatarBg(hueOf(t.studentId)) }}>
        {initials(t.studentName)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink">
          {t.studentName} <span className="text-ink-faint">→</span> {t.mentorName}
        </div>
        {t.booking ? (
          <div className="text-xs text-ink-faint">
            {t.booking.topic} · {t.booking.kind === 'group' ? 'Group' : '1:1'} ·{' '}
            {t.booking.access === 'casual' ? 'Casual (sub)' : 'Paid'} · {formatSlot(t.booking.startsAt)}
          </div>
        ) : (
          <div className="text-xs text-ink-faint">Booking #{t.bookingId.slice(0, 8)}</div>
        )}
        {t.booking?.feedbackScore != null ? (
          <div className="mt-1 flex items-center gap-2">
            <StarRating score={t.booking.feedbackScore} size="sm" />
            {t.booking.feedbackComment ? <span className="truncate text-xs text-ink-muted">“{t.booking.feedbackComment}”</span> : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <div className="text-sm font-semibold text-ink">{formatPrice(t.amountCents)}</div>
        <StatusBadge status={t.status} />
      </div>

      <div className="flex w-full justify-end gap-2 sm:w-auto">
        {t.status === 'pending' ? (
          <>
            <button
              type="button"
              onClick={() => onAct('approve')}
              disabled={busy}
              className="flex h-8 items-center gap-1.5 rounded-md bg-accent-green px-3 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              <Check className="size-3.5" /> Approve
            </button>
            <button
              type="button"
              onClick={() => onAct('reject')}
              disabled={busy}
              className="flex h-8 items-center gap-1.5 rounded-md bg-surface-sunken px-3 text-xs font-semibold text-ink ring-1 ring-border-subtle transition hover:text-accent-red hover:ring-border-strong disabled:opacity-50"
            >
              <X className="size-3.5" /> Reject
            </button>
          </>
        ) : t.status === 'approved' ? (
          <button
            type="button"
            onClick={() => onAct('refund')}
            disabled={busy}
            className="flex h-8 items-center gap-1.5 rounded-md bg-surface-sunken px-3 text-xs font-semibold text-ink ring-1 ring-border-subtle transition hover:text-accent-red hover:ring-border-strong disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" /> Refund
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TransactionStatus }) {
  if (status === 'pending') return <Badge variant="warning" size="sm">Pending</Badge>;
  if (status === 'approved') return <Badge variant="success" size="sm">Approved</Badge>;
  if (status === 'refunded') return <Badge variant="danger" size="sm">Refunded</Badge>;
  return <Badge variant="outline" size="sm">Rejected</Badge>;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
