import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { PageHeader } from '../../components/PageHeader.js';
import { AvatarUploader } from '../../components/AvatarUploader.js';
import { ArrowLeft, CalendarClock, MessagesSquare, Plus, Send, Trash2, UserCog, Users, Video, X } from 'lucide-react';
import { Badge, Card } from '@mentra/ui';
import type { BookingJoinResponse, MentorBookingView, MentorThreadView, MentorView, SlotAccess, SlotKind } from '@mentra/shared';
import { getStoredUser } from '../../lib/auth.js';
import { useMyAccess } from '../../lib/access.js';
import { CallStage, LiveStage } from '../../lib/livekit.js';
import { StarRating } from '../../components/StarRating.js';
import {
  avatarBg,
  formatPrice,
  formatSlot,
  hueOf,
  useAddSlot,
  useCancelSlot,
  useMentorBookings,
  useMentorThreads,
  useMyAvailability,
  useMyMentorProfile,
  useReplyDoubt,
  useStartSession,
  useThreadMessages,
  useUpdateMentorProfile,
} from '../../lib/mentors.js';

/**
 * Mentor Mentorship — the mentor side of the Mentors feature: edit your public
 * profile, publish availability slots, see who booked you, and answer student doubts.
 */

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

/** A few popular IANA timezones for the profile dropdown. */
const TIMEZONES: { value: string; label: string }[] = [
  { value: 'Asia/Kolkata', label: 'India — IST (Asia/Kolkata)' },
  { value: 'America/New_York', label: 'US East — ET (America/New_York)' },
  { value: 'America/Los_Angeles', label: 'US West — PT (America/Los_Angeles)' },
  { value: 'Europe/London', label: 'UK — GMT/BST (Europe/London)' },
  { value: 'Asia/Singapore', label: 'Singapore — SGT (Asia/Singapore)' },
];

type Tab = 'profile' | 'availability' | 'bookings' | 'doubts';

export function MentorMentorshipPage() {
  const { data: access } = useMyAccess();
  const canMentor = access?.roleId === 'mentor' || access?.isAdmin === true;
  const [tab, setTab] = useState<Tab>('profile');

  if (!canMentor) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Card>
          <div className="text-sm font-medium text-ink">Mentors only</div>
          <p className="mt-1 text-sm leading-6 text-ink-muted">This area is for mentors managing their 1:1s.</p>
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
      <motion.div variants={fadeUp}>
        <PageHeader
          icon={<UserCog />}
          title="Mentorship"
          subtitle="Your profile, availability, bookings, and student doubts."
        />
      </motion.div>

      <motion.div variants={fadeUp} className="flex gap-1 rounded-lg bg-surface-sunken p-1">
        <TabButton active={tab === 'profile'} onClick={() => setTab('profile')}>Profile</TabButton>
        <TabButton active={tab === 'availability'} onClick={() => setTab('availability')}>Availability</TabButton>
        <TabButton active={tab === 'bookings'} onClick={() => setTab('bookings')}>Bookings</TabButton>
        <TabButton active={tab === 'doubts'} onClick={() => setTab('doubts')}>Doubts</TabButton>
      </motion.div>

      {tab === 'profile' ? <ProfileTab /> : tab === 'availability' ? <AvailabilityTab /> : tab === 'bookings' ? <BookingsTab /> : <DoubtsTab />}
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

// --- Profile ---

function ProfileTab() {
  const profile = useMyMentorProfile();
  const update = useUpdateMentorProfile();
  const [form, setForm] = useState<MentorView | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile.data && !form) setForm(profile.data);
  }, [profile.data, form]);

  if (profile.isLoading || !form) return <Card className="text-sm text-ink-muted">Loading your profile…</Card>;

  async function save() {
    if (!form) return;
    setSaved(false);
    await update.mutateAsync({
      headline: form.headline ?? '',
      bio: form.bio ?? '',
      expertise: form.expertise,
      techStack: form.techStack,
      yearsExperience: form.yearsExperience,
      timezone: form.timezone,
      accepting: form.accepting,
      sessionPriceCents: form.sessionPriceCents,
      feedbackPrompt: form.feedbackPrompt ?? '',
    });
    setSaved(true);
  }

  return (
    <motion.div variants={fadeUp}>
      <Card className="flex flex-col gap-4">
        <Field label="Profile picture">
          <AvatarUploader
            currentUrl={form.avatarUrl}
            name={form.name}
            onChange={(avatarUrl) => setForm({ ...form, avatarUrl })}
          />
        </Field>
        <Field label="Headline">
          <input
            value={form.headline ?? ''}
            onChange={(e) => setForm({ ...form, headline: e.target.value })}
            placeholder="e.g. Senior SWE @ Stripe · System design & DSA"
            className="auth-input-plain h-11 w-full"
          />
        </Field>
        <Field label="Bio">
          <textarea
            value={form.bio ?? ''}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={3}
            placeholder="Tell students how you can help."
            className="auth-input-plain w-full resize-none py-2"
          />
        </Field>
        <Field label="Expertise">
          <TagInput
            value={form.expertise}
            onChange={(expertise) => setForm({ ...form, expertise })}
            placeholder="Type a skill, press comma — e.g. System design"
          />
        </Field>
        <Field label="Tech stack">
          <TagInput
            value={form.techStack}
            onChange={(techStack) => setForm({ ...form, techStack })}
            placeholder="Type a tech, press comma — e.g. React"
          />
        </Field>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Field label="Years of experience" className="sm:w-48">
            <input
              type="number"
              min={0}
              max={60}
              value={form.yearsExperience ?? ''}
              onChange={(e) => setForm({ ...form, yearsExperience: e.target.value === '' ? null : Number(e.target.value) })}
              className="auth-input-plain h-11 w-full"
            />
          </Field>
          <Field label="Timezone" className="flex-1">
            <select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="auth-input-plain h-11 w-full"
            >
              {/* Keep an already-saved value selectable even if it's not in the shortlist. */}
              {!TIMEZONES.some((t) => t.value === form.timezone) ? (
                <option value={form.timezone}>{form.timezone}</option>
              ) : null}
              {TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Field label="Session price (₹)" className="sm:w-48">
            <input
              type="number"
              min={0}
              value={form.sessionPriceCents ? Math.round(form.sessionPriceCents / 100) : ''}
              onChange={(e) =>
                setForm({ ...form, sessionPriceCents: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) * 100 })
              }
              placeholder="0 = free"
              className="auth-input-plain h-11 w-full"
            />
          </Field>
          <Field label="Feedback prompt (shown to students after a session)" className="flex-1">
            <input
              value={form.feedbackPrompt ?? ''}
              onChange={(e) => setForm({ ...form, feedbackPrompt: e.target.value })}
              placeholder="e.g. How clear and useful was the guidance?"
              className="auth-input-plain h-11 w-full"
            />
          </Field>
        </div>

        <label className="flex items-center gap-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.accepting}
            onChange={(e) => setForm({ ...form, accepting: e.target.checked })}
            className="size-4 accent-accent-blue"
          />
          Accepting new mentees
        </label>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={update.isPending}
            className="h-11 rounded-md bg-accent-blue px-6 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {update.isPending ? 'Saving…' : 'Save profile'}
          </button>
          {saved ? <span className="text-xs font-medium text-accent-green">Saved</span> : null}
        </div>
      </Card>
    </motion.div>
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</label>
      {children}
    </div>
  );
}

// --- Availability ---

function AvailabilityTab() {
  const slots = useMyAvailability();
  const add = useAddSlot();
  const cancel = useCancelSlot();
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [kind, setKind] = useState<SlotKind>('one_to_one');
  const [access, setAccess] = useState<SlotAccess>('paid');
  const [capacity, setCapacity] = useState(10);
  const [err, setErr] = useState<string | null>(null);

  async function addSlot() {
    if (!startsAt || !endsAt) return;
    setErr(null);
    try {
      await add.mutateAsync({
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        kind,
        access,
        capacity: kind === 'group' ? Math.max(2, capacity) : 1,
      });
      setStartsAt('');
      setEndsAt('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add slot');
    }
  }

  const data = slots.data ?? [];

  return (
    <motion.div variants={fadeUp} className="space-y-4">
      <Card className="flex flex-col gap-3">
        <div className="text-sm font-medium text-ink">Publish a slot</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Field label="Type" className="sm:w-40">
            <select value={kind} onChange={(e) => setKind(e.target.value as SlotKind)} className="auth-input-plain h-11 w-full">
              <option value="one_to_one">1:1 session</option>
              <option value="group">Group session</option>
            </select>
          </Field>
          <Field label="Access" className="sm:w-48">
            <select value={access} onChange={(e) => setAccess(e.target.value as SlotAccess)} className="auth-input-plain h-11 w-full">
              <option value="paid">Paid (per session)</option>
              <option value="casual">Casual (subscribers)</option>
            </select>
          </Field>
          {kind === 'group' ? (
            <Field label="Seats" className="sm:w-28">
              <input type="number" min={2} max={500} value={capacity} onChange={(e) => setCapacity(Number(e.target.value) || 2)} className="auth-input-plain h-11 w-full" />
            </Field>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Field label="Start" className="flex-1">
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="auth-input-plain h-11 w-full" />
          </Field>
          <Field label="End" className="flex-1">
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="auth-input-plain h-11 w-full" />
          </Field>
        </div>
        {err ? <div className="text-xs font-medium text-accent-red">{err}</div> : null}
        <button
          type="button"
          onClick={addSlot}
          disabled={!startsAt || !endsAt || add.isPending}
          className="flex h-11 items-center justify-center gap-2 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50 sm:self-start"
        >
          <Plus className="size-4" /> {add.isPending ? 'Adding…' : 'Add slot'}
        </button>
      </Card>

      <div>
        <div className="mb-2 text-sm font-medium text-ink">Upcoming slots</div>
        {slots.isLoading ? (
          <Card className="text-sm text-ink-muted">Loading…</Card>
        ) : data.length === 0 ? (
          <Card className="text-sm text-ink-muted">No upcoming slots — publish one above.</Card>
        ) : (
          <Card className="divide-y divide-border-subtle p-0">
            {data.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                {s.kind === 'group' ? <Users className="size-4 shrink-0 text-ink-muted" /> : <CalendarClock className="size-4 shrink-0 text-ink-muted" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink">{formatSlot(s.startsAt)}</div>
                  <div className="text-xs text-ink-faint">
                    {s.kind === 'group' ? `Group · ${s.seatsTaken}/${s.capacity} booked` : '1:1 session'} ·{' '}
                    {s.access === 'casual' ? 'Casual (subscribers)' : 'Paid'}
                  </div>
                </div>
                {s.status === 'booked' ? (
                  <Badge variant="info" size="sm">Full</Badge>
                ) : s.seatsTaken > 0 ? (
                  <Badge variant="warning" size="sm">{s.seatsTaken} booked</Badge>
                ) : (
                  <button
                    type="button"
                    onClick={() => cancel.mutate(s.id)}
                    disabled={cancel.isPending}
                    className="grid size-8 place-items-center rounded-md text-ink-muted transition hover:bg-surface-sunken hover:text-accent-red disabled:opacity-50"
                    aria-label="Remove slot"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </Card>
        )}
      </div>
    </motion.div>
  );
}

// --- Bookings ---

function BookingsTab() {
  const bookings = useMentorBookings();
  const start = useStartSession();
  const [call, setCall] = useState<{ join: BookingJoinResponse; title: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function startSession(b: MentorBookingView) {
    setErr(null);
    try {
      const conn = await start.mutateAsync(b.slotId);
      setCall({ join: conn, title: `${b.topic}` });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start the session');
    }
  }

  if (bookings.isLoading) return <Card className="text-sm text-ink-muted">Loading bookings…</Card>;
  const data = bookings.data ?? [];
  if (data.length === 0) return <Card className="text-sm text-ink-muted">No one has booked you yet.</Card>;

  return (
    <motion.div variants={fadeUp} className="space-y-3">
      {err ? <div className="text-xs font-medium text-accent-red">{err}</div> : null}
      <Card className="divide-y divide-border-subtle p-0">
        {data.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: avatarBg(hueOf(b.studentId)) }}>
              {initials(b.studentName)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{b.topic}</div>
              <div className="text-xs text-ink-faint">
                {b.studentName} · {formatSlot(b.startsAt)} · {b.kind === 'group' ? 'Group' : '1:1'} ·{' '}
                {b.access === 'casual' ? 'Included' : formatPrice(b.priceCents)}
              </div>
              {b.note ? <div className="mt-0.5 truncate text-xs text-ink-muted">“{b.note}”</div> : null}
              {b.feedbackScore != null ? (
                <div className="mt-1 flex items-center gap-2">
                  <StarRating score={b.feedbackScore} size="sm" />
                  {b.feedbackComment ? <span className="truncate text-xs text-ink-muted">“{b.feedbackComment}”</span> : null}
                </div>
              ) : null}
            </div>
            {b.status === 'confirmed' ? (
              <button
                type="button"
                onClick={() => startSession(b)}
                disabled={start.isPending}
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-accent-blue px-3 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                <Video className="size-3.5" /> Start
              </button>
            ) : b.status === 'pending_payment' ? (
              <Badge variant="warning" size="sm">Awaiting payment</Badge>
            ) : (
              <Badge variant={b.status === 'completed' ? 'info' : 'outline'} size="sm">
                {b.status === 'completed' ? 'Completed' : b.status === 'rejected' ? 'Rejected' : 'Cancelled'}
              </Badge>
            )}
          </div>
        ))}
      </Card>
      {call ? <MentorCallOverlay join={call.join} title={call.title} onClose={() => setCall(null)} /> : null}
    </motion.div>
  );
}

function MentorCallOverlay({ join, title, onClose }: { join: BookingJoinResponse; title: string; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{title}</div>
          <div className="text-xs text-ink-faint">{join.kind === 'group' ? 'Group session — you’re broadcasting' : '1:1 session'}</div>
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
            <LiveStage token={join.token} wsUrl={join.wsUrl} publish mentorId={join.mentorId} mentorName={join.mentorName} onLeft={onClose} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// --- Doubts (mentor inbox) ---

function DoubtsTab() {
  const threads = useMentorThreads();
  const [open, setOpen] = useState<MentorThreadView | null>(null);

  if (threads.isLoading) return <Card className="text-sm text-ink-muted">Loading doubts…</Card>;
  const data = threads.data ?? [];

  return (
    <motion.div variants={fadeUp}>
      {data.length === 0 ? (
        <Card className="text-sm text-ink-muted">No student doubts yet.</Card>
      ) : (
        <Card className="divide-y divide-border-subtle p-0">
          {data.map((t) => (
            <button key={t.id} type="button" onClick={() => setOpen(t)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-sunken">
              <span className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: avatarBg(hueOf(t.studentId)) }}>
                {initials(t.studentName)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{t.studentName}</div>
                <div className="truncate text-xs text-ink-faint">{t.lastMessagePreview ?? 'No messages yet'}</div>
              </div>
              <MessagesSquare className="size-4 shrink-0 text-ink-faint" />
            </button>
          ))}
        </Card>
      )}
      {open ? <MentorThreadModal thread={open} onClose={() => setOpen(null)} /> : null}
    </motion.div>
  );
}

function MentorThreadModal({ thread, onClose }: { thread: MentorThreadView; onClose: () => void }) {
  const selfId = getStoredUser()?.id ?? null;
  const messages = useThreadMessages(thread.id);
  const reply = useReplyDoubt();
  const [body, setBody] = useState('');

  async function submit() {
    if (!body.trim()) return;
    await reply.mutateAsync({ threadId: thread.id, body: body.trim() });
    setBody('');
  }

  const data = messages.data ?? [];

  // Portal to <body> so `fixed inset-0` is viewport-relative (not trapped by the
  // animated page container) — keeps the modal centered, not pushed down.
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
            <h2 className="text-sm font-semibold text-ink">{thread.studentName}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-md text-ink-muted transition hover:bg-surface-sunken hover:text-ink">
              <X className="size-4" />
            </button>
          </div>
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
                placeholder="Reply to your student…"
                className="auth-input-plain h-10 flex-1"
              />
              <button
                type="button"
                onClick={submit}
                disabled={!body.trim() || reply.isPending}
                className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-blue text-white transition hover:brightness-110 disabled:opacity-50"
                aria-label="Send"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>,
    document.body,
  );
}

/** Pill/tag input: commits a tag on comma or Enter, X to remove, Backspace deletes last. */
function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  function addTokens(raw: string) {
    const tokens = splitTags(raw);
    if (tokens.length === 0) return;
    const next = [...value];
    for (const t of tokens) {
      if (!next.some((v) => v.toLowerCase() === t.toLowerCase())) next.push(t);
    }
    onChange(next);
  }

  function commitDraft() {
    if (draft.trim()) {
      addTokens(draft);
      setDraft('');
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      commitDraft();
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex min-h-[2.75rem] flex-wrap items-center gap-1.5 rounded-md bg-surface-sunken px-2 py-1.5 ring-1 ring-border-subtle transition focus-within:ring-border-strong">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-surface-raised px-2 py-0.5 text-xs text-ink ring-1 ring-border-subtle"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            aria-label={`Remove ${tag}`}
            className="grid size-4 place-items-center rounded-full text-ink-faint transition hover:bg-accent-red/15 hover:text-accent-red"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          // A comma typed (or pasted) anywhere commits the token(s) immediately.
          if (v.includes(',')) {
            addTokens(v);
            setDraft('');
          } else {
            setDraft(v);
          }
        }}
        onKeyDown={onKeyDown}
        onBlur={commitDraft}
        placeholder={value.length === 0 ? placeholder : ''}
        className="h-7 min-w-[8rem] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
      />
    </div>
  );
}

function splitTags(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
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
