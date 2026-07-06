import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CalendarClock,
  Copy,
  LayoutGrid,
  MessagesSquare,
  Send,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserRound,
  Users,
  Video,
  X,
} from 'lucide-react';
import { Avatar, Badge, Card } from '@mentra/ui';
import type {
  BookingJoinResponse,
  MentorBookingView,
  MentorMatchView,
  MentorThreadView,
  MentorView,
  OpenSessionView,
} from '@mentra/shared';
import { getStoredUser, resolveAvatarUrl } from '../../lib/auth.js';
import { CallStage, LiveStage } from '../../lib/livekit.js';
import { StarRating } from '../../components/StarRating.js';
import { PageHeader } from '../../components/PageHeader.js';
import {
  avatarBg,
  formatPrice,
  formatSlot,
  hueOf,
  useBookSlot,
  useBookingJoinToken,
  useCancelBooking,
  useJoinByCode,
  useMentorMatches,
  useMentorSlots,
  useMyBookings,
  useMyThreads,
  useOpenSessions,
  useSendDoubt,
  useSubmitFeedback,
  useThreadMessages,
} from '../../lib/mentors.js';

/**
 * Student Mentors — browse AI-matched mentors, book & pay for 1:1 or group sessions,
 * join the call by code, ask async "doubts", and leave feedback after a session.
 */

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

type Tab = 'find' | 'browse' | 'sessions' | 'doubts';
type ActiveCall = { join: BookingJoinResponse; title: string; booking: MentorBookingView | null };
export type CheckoutTarget = {
  mentor: { userId: string; name: string; sessionPriceCents: number };
  presetSlotId?: string;
};

/** Maps a browsable open session to a checkout target (mentor + preset slot). */
export function sessionToCheckout(s: OpenSessionView): CheckoutTarget {
  return {
    mentor: { userId: s.mentorId, name: s.mentorName, sessionPriceCents: s.priceCents },
    presetSlotId: s.slotId,
  };
}

export function MentorsPage() {
  const [tab, setTab] = useState<Tab>('find');
  const [checkout, setCheckout] = useState<CheckoutTarget | null>(null);
  const [doubtMentor, setDoubtMentor] = useState<MentorView | null>(null);
  const [openThread, setOpenThread] = useState<MentorThreadView | null>(null);
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [feedback, setFeedback] = useState<MentorBookingView | null>(null);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto w-full max-w-8xl"
    >
      <motion.div variants={fadeUp}>
        <PageHeader
          icon={<UserRound />}
          title="Mentors"
          subtitle="1:1 guidance — matched to your goals, on your schedule."
        />
      </motion.div>

      <motion.div variants={fadeUp}>
        <TabBar tab={tab} onChange={setTab} />
      </motion.div>

      {tab === 'find' ? (
        <FindTab onBook={(m) => setCheckout({ mentor: m })} onAsk={setDoubtMentor} />
      ) : tab === 'browse' ? (
        <BrowseTab
          onBook={(s) => setCheckout(sessionToCheckout(s))}
          onJoined={(join, title) => setCall({ join, title, booking: null })}
        />
      ) : tab === 'sessions' ? (
        <SessionsTab onCall={setCall} onFeedback={setFeedback} />
      ) : (
        <DoubtsTab onOpen={setOpenThread} />
      )}

      {checkout ? (
        <CheckoutModal
          mentor={checkout.mentor}
          presetSlotId={checkout.presetSlotId}
          onClose={() => setCheckout(null)}
          onDone={() => setTab('sessions')}
        />
      ) : null}
      {doubtMentor ? (
        <DoubtComposerModal mentor={doubtMentor} onClose={() => setDoubtMentor(null)} onSent={() => setTab('doubts')} />
      ) : null}
      {openThread ? <ThreadModal thread={openThread} onClose={() => setOpenThread(null)} /> : null}
      {call ? (
        <CallOverlay
          call={call}
          onClose={() => {
            const b = call.booking;
            setCall(null);
            // Prompt for feedback after a 1:1/group session ends.
            if (b && b.feedbackScore == null) setFeedback(b);
          }}
        />
      ) : null}
      {feedback ? <FeedbackModal booking={feedback} onClose={() => setFeedback(null)} /> : null}
    </motion.div>
  );
}

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'find', label: 'Find a mentor', icon: <Sparkles className="size-4" /> },
  { id: 'browse', label: 'Sessions', icon: <LayoutGrid className="size-4" /> },
  { id: 'sessions', label: 'My sessions', icon: <CalendarClock className="size-4" /> },
  { id: 'doubts', label: 'Doubts', icon: <MessagesSquare className="size-4" /> },
];

/** Horizontally scrollable, snap-centering tab bar (active tab auto-centers). */
function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const refs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  useEffect(() => {
    refs.current[tab]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [tab]);

  return (
    <div className="flex mb-3 snap-x snap-mandatory gap-1 overflow-x-auto rounded-lg bg-surface-sunken p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TABS.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            type="button"
            onClick={() => onChange(t.id)}
            className={`flex h-9 shrink-0 snap-center items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition md:flex-1 ${
              active ? 'bg-surface-raised text-ink shadow-sm ring-1 ring-border-subtle' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// --- Find tab ---

function FindTab({ onBook, onAsk }: { onBook: (m: MentorView) => void; onAsk: (m: MentorView) => void }) {
  const matches = useMentorMatches();

  if (matches.isLoading) return <Card className="text-sm text-ink-muted">Finding your best matches…</Card>;
  if (matches.isError) return <Card className="text-sm text-ink-muted">Couldn’t load mentors. Try again shortly.</Card>;
  const data = matches.data ?? [];
  if (data.length === 0) return <Card className="text-sm text-ink-muted">No mentors are available yet — check back soon.</Card>;

  return (
    <motion.div variants={fadeUp} className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((m) => (
        <MentorCard key={m.mentor.userId} match={m} onBook={onBook} onAsk={onAsk} />
      ))}
    </motion.div>
  );
}

function MentorCard({ match, onBook, onAsk }: { match: MentorMatchView; onBook: (m: MentorView) => void; onAsk: (m: MentorView) => void }) {
  const { mentor } = match;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: avatarBg(hueOf(mentor.userId)) }}>
          {mentor.avatarUrl ? <Avatar src={resolveAvatarUrl(mentor.avatarUrl)} name={mentor.name} size="lg" /> : initials(mentor.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">{mentor.name}</div>
          <div className="truncate text-xs text-ink-faint">{mentor.headline ?? 'Mentor'}</div>
        </div>
        {match.score > 0 ? (
          <Badge variant={match.score >= 70 ? 'success' : 'info'} size="sm">
            {match.score}% match
          </Badge>
        ) : null}
      </div>

      <p className="line-clamp-2 text-xs leading-5 text-ink-muted">
        <Sparkles className="mr-1 inline size-3 text-accent-blue" />
        {match.reason}
      </p>

      {mentor.expertise.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {mentor.expertise.slice(0, 4).map((e) => (
            <span key={e} className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-muted ring-1 ring-border-subtle">
              {e}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-sm font-semibold text-ink">{formatPrice(mentor.sessionPriceCents)}<span className="text-xs font-normal text-ink-faint">/session</span></span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAsk(mentor)}
            className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-surface-sunken px-3 text-xs font-semibold text-ink ring-1 ring-border-subtle transition hover:ring-border-strong"
          >
            <MessagesSquare className="size-3.5" /> Ask
          </button>
          <button
            type="button"
            onClick={() => onBook(mentor)}
            disabled={mentor.openSlotCount === 0}
            className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-surface-inverse px-3 text-xs font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
            title={mentor.openSlotCount === 0 ? 'No open slots' : undefined}
          >
            <CalendarClock className="size-3.5" /> {mentor.openSlotCount > 0 ? 'Book' : 'No slots'}
          </button>
        </div>
      </div>
    </Card>
  );
}

// --- Browse all sessions ---

function BrowseTab({
  onBook,
  onJoined,
}: {
  onBook: (s: OpenSessionView) => void;
  onJoined: (join: BookingJoinResponse, title: string) => void;
}) {
  const sessions = useOpenSessions();
  if (sessions.isLoading) return <Card className="text-sm text-ink-muted">Loading sessions…</Card>;
  const data = sessions.data ?? [];
  if (data.length === 0) return <Card className="text-sm text-ink-muted">No sessions are open right now — check the Find tab to message a mentor.</Card>;

  return (
    <motion.div variants={fadeUp} className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((s) => (
        <SessionCard key={s.slotId} session={s} onBook={onBook} onJoined={onJoined} />
      ))}
    </motion.div>
  );
}

export function SessionCard({
  session: s,
  onBook,
  onJoined,
}: {
  session: OpenSessionView;
  onBook: (s: OpenSessionView) => void;
  onJoined: (join: BookingJoinResponse, title: string) => void;
}) {
  const book = useBookSlot();
  const joinToken = useBookingJoinToken();
  const [err, setErr] = useState<string | null>(null);
  const full = s.kind === 'group' && s.seatsLeft <= 0;
  const isCasual = s.access === 'casual';
  const busy = book.isPending || joinToken.isPending;

  // Casual sessions are free/instant for subscribers: auto-book (idempotent) then join.
  async function join() {
    setErr(null);
    try {
      const booking = await book.mutateAsync({
        slotId: s.slotId,
        topic: `${s.kind === 'group' ? 'Group' : '1:1'} session with ${s.mentorName}`,
      });
      const conn = await joinToken.mutateAsync(booking.id);
      onJoined(conn, `${s.mentorName} · ${s.kind === 'group' ? 'Group' : '1:1'} session`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not join');
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: avatarBg(hueOf(s.mentorId)) }}>
          {s.mentorAvatarUrl ? <Avatar src={s.mentorAvatarUrl} name={s.mentorName} size="md" /> : initials(s.mentorName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">{s.mentorName}</div>
          <div className="truncate text-xs text-ink-faint">{s.mentorHeadline ?? 'Mentor'}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="default" size="sm">
          {s.kind === 'group' ? <Users className="size-3" /> : <UserRound className="size-3" />}
          {s.kind === 'group' ? 'Group' : '1:1'}
        </Badge>
        <Badge variant={isCasual ? 'info' : 'warning'} size="sm">
          {isCasual ? 'Subscriber' : 'Paid'}
        </Badge>
        {s.kind === 'group' ? (
          <Badge variant="outline" size="sm">{s.seatsLeft} seat{s.seatsLeft === 1 ? '' : 's'} left</Badge>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-ink-muted">
        <CalendarClock className="size-3.5 text-ink-faint" /> {formatSlot(s.startsAt)}
      </div>

      {err ? <div className="text-xs font-medium text-accent-red">{err}</div> : null}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-sm font-semibold text-ink">{isCasual ? 'Included' : formatPrice(s.priceCents)}</span>
        {isCasual ? (
          <button
            type="button"
            onClick={join}
            disabled={full || busy}
            className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-accent-blue px-4 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            <Video className="size-3.5" /> {busy ? 'Joining…' : full ? 'Full' : 'Join'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onBook(s)}
            disabled={full}
            className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-surface-inverse px-4 text-xs font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
          >
            <CalendarClock className="size-3.5" /> {full ? 'Full' : 'Book'}
          </button>
        )}
      </div>
    </Card>
  );
}

// --- Checkout (multi-step) ---

type CheckoutStep = 'details' | 'pay' | 'done';

export function CheckoutModal({
  mentor,
  presetSlotId,
  onClose,
  onDone,
}: {
  mentor: { userId: string; name: string; sessionPriceCents: number };
  presetSlotId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const slots = useMentorSlots(mentor.userId);
  const book = useBookSlot();
  const [step, setStep] = useState<CheckoutStep>('details');
  const [slotId, setSlotId] = useState<string | null>(presetSlotId ?? null);
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
            <span className="text-base font-semibold text-ink">
              {isCasual ? 'Included with subscription' : formatPrice(price)}
            </span>
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
            After the session you’ll rate it. Your honest feedback keeps mentor quality high and is reviewed for refunds —
            if a paid session didn’t deliver, our team can refund you based on it. Payments are verified before your
            session is confirmed.
          </div>

          {err ? <div className="text-xs font-medium text-accent-red">{err}</div> : null}

          {isCasual ? (
            <button
              type="button"
              onClick={book_}
              disabled={!slotId || !topic.trim() || book.isPending}
              className="h-11 w-full rounded-md bg-accent-blue text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {book.isPending ? 'Booking…' : 'Confirm booking (included)'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep('pay')}
              disabled={!slotId || !topic.trim()}
              className="h-11 w-full rounded-md bg-surface-inverse text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
            >
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
          <button
            type="button"
            onClick={book_}
            disabled={book.isPending}
            className="h-11 w-full rounded-md bg-accent-blue text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
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
              Your payment is pending verification. Once approved, your join code appears in <b>My sessions</b> and
              you can join the call.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onDone();
            }}
            className="h-11 w-full rounded-md bg-surface-inverse text-sm font-semibold text-ink-inverse transition hover:bg-ink"
          >
            Go to My sessions
          </button>
        </div>
      )}
    </Modal>
  );
}

// --- Doubt composer ---

function DoubtComposerModal({ mentor, onClose, onSent }: { mentor: MentorView; onClose: () => void; onSent: () => void }) {
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

// --- Sessions tab ---

function SessionsTab({ onCall, onFeedback }: { onCall: (c: ActiveCall) => void; onFeedback: (b: MentorBookingView) => void }) {
  const bookings = useMyBookings();
  const cancel = useCancelBooking();
  const joinToken = useBookingJoinToken();
  const joinCode = useJoinByCode();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function join(b: MentorBookingView) {
    setErr(null);
    try {
      const conn = await joinToken.mutateAsync(b.id);
      onCall({ join: conn, title: `${b.mentorName} · ${b.topic}`, booking: b });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not join');
    }
  }

  async function joinWithCode() {
    if (!code.trim()) return;
    setErr(null);
    try {
      const conn = await joinCode.mutateAsync(code.trim().toUpperCase());
      onCall({ join: conn, title: `${conn.mentorName} · session`, booking: null });
      setCode('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Invalid code');
    }
  }

  if (bookings.isLoading) return <Card className="text-sm text-ink-muted">Loading your sessions…</Card>;
  const data = bookings.data ?? [];

  return (
    <motion.div variants={fadeUp} className="space-y-4">
      <Card className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-ink-muted">Have a code? Join a session</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. 9F3A2B7C"
            className="auth-input-plain h-11 w-full uppercase tracking-widest"
          />
        </div>
        <button
          type="button"
          onClick={joinWithCode}
          disabled={!code.trim() || joinCode.isPending}
          className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-accent-blue px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          <Ticket className="size-4" /> Join
        </button>
      </Card>

      {err ? <div className="text-xs font-medium text-accent-red">{err}</div> : null}

      {data.length === 0 ? (
        <Card className="text-sm text-ink-muted">No sessions yet — book a mentor from the Find tab.</Card>
      ) : (
        <Card className="divide-y divide-border-subtle p-0">
          {data.map((b) => (
            <BookingRow key={b.id} booking={b} onJoin={join} onCancel={(id) => cancel.mutate(id)} onFeedback={onFeedback} joining={joinToken.isPending} />
          ))}
        </Card>
      )}
    </motion.div>
  );
}

function BookingRow({
  booking: b,
  onJoin,
  onCancel,
  onFeedback,
  joining,
}: {
  booking: MentorBookingView;
  onJoin: (b: MentorBookingView) => void;
  onCancel: (id: string) => void;
  onFeedback: (b: MentorBookingView) => void;
  joining: boolean;
}) {
  const canJoin = b.status === 'confirmed' && !!b.joinCode;
  const canFeedback = (b.status === 'confirmed' || b.status === 'completed') && b.feedbackScore == null;
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-md text-white" style={{ background: avatarBg(hueOf(b.mentorId)) }}>
        <CalendarClock className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{b.topic}</div>
        <div className="text-xs text-ink-faint">
          {b.mentorName} · {formatSlot(b.startsAt)} · {b.kind === 'group' ? 'Group' : '1:1'} ·{' '}
          {b.access === 'casual' ? 'Included' : formatPrice(b.priceCents)}
        </div>
        {canJoin ? (
          <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
            <Ticket className="size-3" /> Code: <span className="font-mono font-semibold text-ink">{b.joinCode}</span>
            <button type="button" onClick={() => navigator.clipboard?.writeText(b.joinCode ?? '')} className="text-ink-faint transition hover:text-ink" aria-label="Copy code">
              <Copy className="size-3" />
            </button>
          </div>
        ) : null}
      </div>
      <PaymentBadge booking={b} />
      <div className="flex items-center gap-2">
        {canJoin ? (
          <button
            type="button"
            onClick={() => onJoin(b)}
            disabled={joining}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-accent-blue px-3 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            <Video className="size-3.5" /> Join
          </button>
        ) : null}
        {canFeedback ? (
          <button
            type="button"
            onClick={() => onFeedback(b)}
            className="h-8 shrink-0 rounded-md bg-surface-sunken px-3 text-xs font-medium text-ink ring-1 ring-border-subtle transition hover:ring-border-strong"
          >
            Feedback
          </button>
        ) : null}
        {b.status === 'pending_payment' || b.status === 'confirmed' ? (
          <button
            type="button"
            onClick={() => onCancel(b.id)}
            className="h-8 shrink-0 rounded-md px-2 text-xs font-medium text-ink-faint transition hover:text-accent-red"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PaymentBadge({ booking: b }: { booking: MentorBookingView }) {
  if (b.paymentStatus === 'refunded') return <Badge variant="danger" size="sm">Refunded</Badge>;
  if (b.status === 'pending_payment') return <Badge variant="warning" size="sm">Awaiting approval</Badge>;
  if (b.status === 'rejected') return <Badge variant="danger" size="sm">Payment rejected</Badge>;
  if (b.status === 'confirmed') return <Badge variant="success" size="sm">Confirmed</Badge>;
  if (b.status === 'completed') return <Badge variant="info" size="sm">Completed</Badge>;
  return <Badge variant="outline" size="sm">Cancelled</Badge>;
}

// --- Feedback ---

function FeedbackModal({ booking, onClose }: { booking: MentorBookingView; onClose: () => void }) {
  const submit = useSubmitFeedback();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    if (score === 0) return;
    setErr(null);
    try {
      await submit.mutateAsync({ bookingId: booking.id, score, comment: comment.trim() || undefined });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not submit feedback');
    }
  }

  return (
    <Modal title={`Rate your session with ${booking.mentorName}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-md bg-accent-blue/5 p-3 text-xs leading-5 text-ink-muted ring-1 ring-accent-blue/15">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-ink">
            <ShieldCheck className="size-3.5 text-accent-blue" /> Why this matters
          </div>
          Your rating keeps mentor quality high and is what our team reviews when deciding refunds. Be honest — if the
          session didn’t deliver, say so.
        </div>
        <div className="flex flex-col items-center gap-2 py-2">
          <StarRating score={score} onChange={setScore} size="lg" />
          <span className="text-xs text-ink-faint">{score === 0 ? 'Tap to rate' : `${score} / 5`}</span>
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="What went well, or what could be better?"
          className="auth-input-plain w-full resize-none py-2"
        />
        {err ? <div className="text-xs font-medium text-accent-red">{err}</div> : null}
        <button
          type="button"
          onClick={send}
          disabled={score === 0 || submit.isPending}
          className="h-11 w-full rounded-md bg-accent-blue text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {submit.isPending ? 'Submitting…' : 'Submit feedback'}
        </button>
      </div>
    </Modal>
  );
}

// --- Call overlay ---

function CallOverlay({ call, onClose }: { call: ActiveCall; onClose: () => void }) {
  const { join } = call;
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{call.title}</div>
          <div className="text-xs text-ink-faint">{join.kind === 'group' ? 'Group session' : '1:1 session'}</div>
        </div>
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-md bg-surface-sunken px-3 py-1.5 text-sm font-medium text-ink ring-1 ring-border-subtle transition hover:ring-border-strong">
          <ArrowLeft className="size-4" /> Leave
        </button>
      </header>
      <div className="flex flex-1 items-center justify-center overflow-auto p-4">
        <div className="w-full max-w-5xl">
          {join.kind === 'one_to_one' ? (
            <CallStage token={join.token} wsUrl={join.wsUrl} onLeft={onClose} />
          ) : (
            <LiveStage
              token={join.token}
              wsUrl={join.wsUrl}
              publish={join.canPublish}
              mentorId={join.mentorId}
              mentorName={join.mentorName}
              onLeft={onClose}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// --- Doubts tab ---

function DoubtsTab({ onOpen }: { onOpen: (t: MentorThreadView) => void }) {
  const threads = useMyThreads();
  if (threads.isLoading) return <Card className="text-sm text-ink-muted">Loading your doubts…</Card>;
  const data = threads.data ?? [];
  if (data.length === 0) return <Card className="text-sm text-ink-muted">No doubts yet — tap “Ask” on a mentor to start one.</Card>;

  return (
    <motion.div variants={fadeUp}>
      <Card className="divide-y divide-border-subtle p-0">
        {data.map((t) => (
          <button key={t.id} type="button" onClick={() => onOpen(t)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-sunken">
            <span className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: avatarBg(hueOf(t.mentorId)) }}>
              {initials(t.mentorName)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{t.mentorName}</div>
              <div className="truncate text-xs text-ink-faint">{t.lastMessagePreview ?? 'No messages yet'}</div>
            </div>
            <MessagesSquare className="size-4 shrink-0 text-ink-faint" />
          </button>
        ))}
      </Card>
    </motion.div>
  );
}

function ThreadModal({ thread, onClose }: { thread: MentorThreadView; onClose: () => void }) {
  const selfId = getStoredUser()?.id ?? null;
  const messages = useThreadMessages(thread.id);
  const send = useSendDoubt();
  const [body, setBody] = useState('');

  async function submit() {
    if (!body.trim()) return;
    await send.mutateAsync({ mentorId: thread.mentorId, body: body.trim() });
    setBody('');
  }

  const data = messages.data ?? [];

  return (
    <Modal title={thread.mentorName} onClose={onClose}>
      <div className="flex max-h-[60vh] flex-col">
        <div className="flex-1 space-y-2 overflow-auto pr-1">
          {data.length === 0 ? (
            <div className="py-6 text-center text-sm text-ink-muted">No messages yet.</div>
          ) : (
            data.map((m) => {
              const mine = m.authorUserId === selfId;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-accent-blue text-white' : 'bg-surface-sunken text-ink'}`}>
                    {m.body}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-border-subtle pt-3">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Type a message…"
            className="auth-input-plain h-10 flex-1"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!body.trim() || send.isPending}
            className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-blue text-white transition hover:brightness-110 disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </Modal>
  );
}

// --- Shared modal shell ---

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  // Portal to <body> so `fixed inset-0` is viewport-relative — otherwise the
  // animated page container (transform) traps it and it drops below the top bar.
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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
