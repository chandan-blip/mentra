import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { CalendarClock, MessagesSquare, Search, Send, ShieldCheck, X } from 'lucide-react';
import { Avatar, Badge, Card } from '@mentra/ui';
import type { MentorMatchView, MentorView } from '@mentra/shared';
import { resolveAvatarUrl } from '../../lib/auth.js';
import {
  avatarBg,
  formatPrice,
  formatSlot,
  hueOf,
  useBookSlot,
  useMentorDetail,
  useMentorMatches,
  useMentorSlots,
  useSendDoubt,
} from '../../lib/mentors.js';
import { MentorBody } from '../mentor/MentorProfile.js';

/**
 * Find a Mentor — a master-detail view: a searchable list of mentors on the left, the selected
 * mentor's full profile on the right. Booked sessions and doubt threads live under Settings.
 */

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

type CheckoutMentor = { userId: string; name: string; sessionPriceCents: number };

export function MentorsPage() {
  const navigate = useNavigate();
  const matches = useMentorMatches();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<CheckoutMentor | null>(null);
  const [doubtMentor, setDoubtMentor] = useState<{ userId: string; name: string } | null>(null);

  const list = matches.data ?? [];
  const q = query.trim().toLowerCase();
  const filtered = q
    ? list.filter(
        (m) =>
          m.mentor.name.toLowerCase().includes(q) ||
          (m.mentor.headline ?? '').toLowerCase().includes(q) ||
          m.mentor.expertise.some((e) => e.toLowerCase().includes(q)),
      )
    : list;

  // The clicked mentor, or the first in the filtered list.
  const selected = filtered.find((m) => m.mentor.userId === selectedId) ?? filtered[0] ?? null;

  const book = (m: CheckoutMentor) => setCheckout(m);
  const ask = (m: { userId: string; name: string }) => setDoubtMentor(m);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto w-full max-w-8xl space-y-6"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <motion.div
          variants={fadeUp}
          className="min-w-0 lg:sticky lg:top-4 lg:self-start lg:h-[calc(100vh-6rem)]"
        >
          <MentorList
            matches={matches}
            filtered={filtered}
            query={query}
            setQuery={setQuery}
            selectedId={selected?.mentor.userId ?? null}
            onSelect={setSelectedId}
          />
        </motion.div>
        <motion.div
          variants={fadeUp}
          className="min-w-0 lg:sticky lg:top-4 lg:self-start lg:h-[calc(100vh-6rem)] lg:overflow-y-auto p-2"
        >
          <MentorDetailPane match={selected} onBook={book} onAsk={ask} />
        </motion.div>
      </div>

      {checkout ? (
        <CheckoutModal
          mentor={checkout}
          onClose={() => setCheckout(null)}
          onDone={() => navigate('/settings?tab=mentor-sessions')}
        />
      ) : null}
      {doubtMentor ? (
        <DoubtComposerModal
          mentor={doubtMentor}
          onClose={() => setDoubtMentor(null)}
          onSent={() => navigate('/settings?tab=doubts')}
        />
      ) : null}
    </motion.div>
  );
}

// --- Left: searchable mentor list ---

function MentorList({
  matches,
  filtered,
  query,
  setQuery,
  selectedId,
  onSelect,
}: {
  matches: ReturnType<typeof useMentorMatches>;
  filtered: MentorMatchView[];
  query: string;
  setQuery: (v: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="flex h-full flex-col gap-4">
      {/* Search stays pinned; only the list below it scrolls. */}
      <div className="flex shrink-0 items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2.5 ring-1 ring-border-subtle transition focus-within:ring-border-strong">
        <Search className="size-4 shrink-0 text-ink-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search mentors by name, role or skill…"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5 p-2">
        {matches.isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[76px] rounded-lg bg-surface-sunken ring-1 ring-border-subtle" />
            ))}
          </div>
        ) : matches.isError ? (
          <Card className="text-sm text-ink-muted">Couldn’t load mentors. Try again shortly.</Card>
        ) : filtered.length === 0 ? (
          <Card className="text-sm text-ink-muted">
            {query.trim() ? `No mentors match “${query.trim()}”.` : 'No mentors are available yet — check back soon.'}
          </Card>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((m) => (
              <MentorRow key={m.mentor.userId} match={m} active={m.mentor.userId === selectedId} onClick={() => onSelect(m.mentor.userId)} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MentorRow({ match, active, onClick }: { match: MentorMatchView; active: boolean; onClick: () => void }) {
  const m = match.mentor;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg px-3 py-3 text-left ring-1 transition ${
        active ? 'bg-accent-blue/[0.05] ring-accent-blue/40' : 'bg-surface ring-border-subtle hover:ring-border-strong'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-semibold text-white" style={{ background: avatarBg(hueOf(m.userId)) }}>
          {m.avatarUrl ? <Avatar src={resolveAvatarUrl(m.avatarUrl)} name={m.name} size="md" /> : initials(m.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">{m.name}</div>
          <div className="truncate text-xs text-ink-faint">{m.headline ?? 'Mentor'}</div>
        </div>
        {match.score > 0 ? (
          <Badge variant={match.score >= 70 ? 'success' : 'info'} size="sm">{match.score}%</Badge>
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-faint">
        <span className="font-medium text-ink-muted">{formatPrice(m.sessionPriceCents)}/session</span>
        <span>{m.openSlotCount} open slot{m.openSlotCount === 1 ? '' : 's'}</span>
      </div>
    </button>
  );
}

// --- Right: selected mentor detail ---

function MentorDetailPane({
  match,
  onBook,
  onAsk,
}: {
  match: MentorMatchView | null;
  onBook: (m: CheckoutMentor) => void;
  onAsk: (m: { userId: string; name: string }) => void;
}) {
  const { data, isLoading } = useMentorDetail(match ? match.mentor.userId : undefined);

  if (!match) {
    return <Card className="grid min-h-[50vh] place-items-center text-sm text-ink-muted">Select a mentor to see their profile.</Card>;
  }
  const m = match.mentor;
  const bookThis = () => onBook({ userId: m.userId, name: m.name, sessionPriceCents: m.sessionPriceCents });
  const askThis = () => onAsk({ userId: m.userId, name: m.name });

  if (data) return <MentorBody mentor={data} onBook={bookThis} onAsk={askThis} />;
  if (isLoading) return <Card className="text-sm text-ink-muted">Loading mentor…</Card>;
  return <BasicProfile mentor={m} onBook={bookThis} onAsk={askThis} />;
}

/** Lightweight profile from the list item — shown while the full profile loads. */
function BasicProfile({ mentor: m, onBook, onAsk }: { mentor: MentorView; onBook: () => void; onAsk: () => void }) {
  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {/* 3:4 portrait, no background. */}
        <div className="aspect-[3/4] w-32 shrink-0 overflow-hidden rounded-xl">
          {m.avatarUrl ? (
            <img src={resolveAvatarUrl(m.avatarUrl)} alt={m.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center rounded-xl text-2xl font-semibold text-ink-faint ring-1 ring-border-subtle">
              {initials(m.name)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-display-sm tracking-normal text-ink">{m.name}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">{m.headline ?? 'Mentor'}</p>
          {m.expertise.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {m.expertise.slice(0, 6).map((e) => (
                <span key={e} className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-muted ring-1 ring-border-subtle">
                  {e}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <div className="text-right text-sm font-semibold text-ink">
            {formatPrice(m.sessionPriceCents)}
            <span className="text-xs font-normal text-ink-faint">/session</span>
          </div>
          <button
            type="button"
            onClick={onBook}
            disabled={m.openSlotCount === 0}
            className="flex h-10 items-center justify-center gap-1.5 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
          >
            <CalendarClock className="size-4" /> {m.openSlotCount > 0 ? 'Book a session' : 'No open slots'}
          </button>
          <button
            type="button"
            onClick={onAsk}
            className="flex h-10 items-center justify-center gap-1.5 rounded-md bg-surface-sunken px-5 text-sm font-semibold text-ink ring-1 ring-border-subtle transition hover:ring-border-strong"
          >
            <MessagesSquare className="size-4" /> Ask a doubt
          </button>
        </div>
      </Card>
    </div>
  );
}

// --- Checkout (multi-step) ---

type CheckoutStep = 'details' | 'pay' | 'done';

function CheckoutModal({
  mentor,
  onClose,
  onDone,
}: {
  mentor: CheckoutMentor;
  onClose: () => void;
  onDone: () => void;
}) {
  const slots = useMentorSlots(mentor.userId);
  const book = useBookSlot();
  const [step, setStep] = useState<CheckoutStep>('details');
  const [slotId, setSlotId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const data = slots.data ?? [];
  const selected = data.find((s) => s.id === slotId) ?? null;
  const isCasual = selected?.access === 'casual';
  const price = selected ? selected.priceCents : mentor.sessionPriceCents;

  async function book_() {
    if (!slotId || !topic.trim()) return;
    setErr(null);
    try {
      await book.mutateAsync({ slotId, topic: topic.trim(), note: note.trim() || undefined });
      setStep('done');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not complete the booking');
    }
  }

  return (
    <Modal title={`Book ${mentor.name}`} onClose={onClose}>
      {step === 'details' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md bg-surface-sunken px-3 py-2 ring-1 ring-border-subtle">
            <span className="text-sm text-ink-muted">{isCasual ? 'Access' : 'Session price'}</span>
            <span className="text-base font-semibold text-ink">{isCasual ? 'Included with subscription' : formatPrice(price)}</span>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Pick a slot</label>
            {slots.isLoading ? (
              <div className="text-sm text-ink-muted">Loading slots…</div>
            ) : data.length === 0 ? (
              <div className="text-sm text-ink-muted">No open slots right now.</div>
            ) : (
              <div className="grid max-h-44 grid-cols-1 gap-2 overflow-auto sm:grid-cols-2">
                {data.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSlotId(s.id)}
                    className={`rounded-md px-3 py-2 text-left text-xs ring-1 transition ${
                      slotId === s.id ? 'bg-accent-blue/10 text-ink ring-accent-blue/40' : 'bg-surface-sunken text-ink-muted ring-border-subtle hover:ring-border-strong'
                    }`}
                  >
                    <div className="font-medium text-ink">{formatSlot(s.startsAt)}</div>
                    <div className="mt-0.5 text-[11px] text-ink-faint">
                      {s.kind === 'group' ? `Group · ${s.seatsLeft} seat${s.seatsLeft === 1 ? '' : 's'} left` : '1:1 session'} ·{' '}
                      {s.access === 'casual' ? 'Subscriber' : formatPrice(s.priceCents)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">What do you want help with?</label>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. System design mock + feedback" className="auth-input-plain h-11 w-full" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Anything the mentor should prepare?" className="auth-input-plain w-full resize-none py-2" />
          </div>

          <div className="rounded-md bg-accent-blue/5 p-3 text-xs leading-5 text-ink-muted ring-1 ring-accent-blue/15">
            <div className="mb-1 flex items-center gap-1.5 font-medium text-ink">
              <ShieldCheck className="size-3.5 text-accent-blue" /> Why your feedback matters
            </div>
            After the session you’ll rate it. Your honest feedback keeps mentor quality high and is reviewed for refunds.
            Payments are verified before your session is confirmed.
          </div>

          {err ? <div className="text-xs font-medium text-accent-red">{err}</div> : null}

          {isCasual ? (
            <button type="button" onClick={book_} disabled={!slotId || !topic.trim() || book.isPending} className="h-11 w-full rounded-md bg-accent-blue text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
              {book.isPending ? 'Booking…' : 'Confirm booking (included)'}
            </button>
          ) : (
            <button type="button" onClick={() => setStep('pay')} disabled={!slotId || !topic.trim()} className="h-11 w-full rounded-md bg-surface-inverse text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50">
              Continue to payment
            </button>
          )}
        </div>
      ) : step === 'pay' ? (
        <div className="space-y-4">
          <div className="rounded-md border border-dashed border-border-strong bg-surface-sunken p-4 text-center">
            <div className="text-xs uppercase tracking-wide text-ink-faint">Demo checkout</div>
            <div className="mt-1 text-2xl font-semibold text-ink">{formatPrice(price)}</div>
            <div className="mt-1 text-xs text-ink-muted">No card is charged — a real gateway will be wired here later.</div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <input disabled value="4242 4242 4242 4242" className="auth-input-plain h-11 w-full opacity-60" />
            <div className="grid grid-cols-2 gap-2">
              <input disabled value="12 / 30" className="auth-input-plain h-11 w-full opacity-60" />
              <input disabled value="•••" className="auth-input-plain h-11 w-full opacity-60" />
            </div>
          </div>
          {err ? <div className="text-xs font-medium text-accent-red">{err}</div> : null}
          <button type="button" onClick={book_} disabled={book.isPending} className="h-11 w-full rounded-md bg-accent-blue text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
            {book.isPending ? 'Processing…' : `Pay ${formatPrice(price)}`}
          </button>
          <button type="button" onClick={() => setStep('details')} className="h-9 w-full text-xs font-medium text-ink-muted transition hover:text-ink">
            Back
          </button>
        </div>
      ) : (
        <div className="space-y-4 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-accent-green/15 text-accent-green">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <div className="text-sm font-semibold text-ink">Payment submitted</div>
            <p className="mt-1 text-xs leading-5 text-ink-muted">
              Your payment is pending verification. Once approved, your join code appears in <b>My sessions</b> and you can join the call.
            </p>
          </div>
          <button type="button" onClick={() => { onClose(); onDone(); }} className="h-11 w-full rounded-md bg-surface-inverse text-sm font-semibold text-ink-inverse transition hover:bg-ink">
            Go to My sessions
          </button>
        </div>
      )}
    </Modal>
  );
}

// --- Doubt composer ---

function DoubtComposerModal({ mentor, onClose, onSent }: { mentor: { userId: string; name: string }; onClose: () => void; onSent: () => void }) {
  const send = useSendDoubt();
  const [body, setBody] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!body.trim()) return;
    setErr(null);
    try {
      await send.mutateAsync({ mentorId: mentor.userId, body: body.trim() });
      onClose();
      onSent();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send');
    }
  }

  return (
    <Modal title={`Ask ${mentor.name}`} onClose={onClose}>
      <div className="space-y-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          autoFocus
          placeholder={`Type your question for ${mentor.name}…`}
          className="auth-input-plain w-full resize-none py-2"
        />
        {err ? <div className="text-xs font-medium text-accent-red">{err}</div> : null}
        <button
          type="button"
          onClick={submit}
          disabled={!body.trim() || send.isPending}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent-blue text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          <Send className="size-4" /> {send.isPending ? 'Sending…' : 'Send doubt'}
        </button>
      </div>
    </Modal>
  );
}

// --- Shared modal shell (also used by the My Sessions / Doubts settings tabs) ---

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-md text-ink-muted transition hover:bg-surface-sunken hover:text-ink">
              <X className="size-4" />
            </button>
          </div>
          {children}
        </Card>
      </motion.div>
    </div>,
    document.body,
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
