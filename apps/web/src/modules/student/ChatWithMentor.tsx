import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarClock, Check, Heart, MessageCircle, MessagesSquare, Send, Sparkles } from 'lucide-react';
import { Avatar } from '@mentra/ui';
import type { CareerChatSessionCard } from '@mentra/shared';
import { PageHeader } from '../../components/PageHeader.js';
import { resolveAvatarUrl } from '../../lib/auth.js';
import { useProfile } from '../../lib/profile.js';
import { useCareerChat, useEnrollSession, useNudge, useSendCareerMessage } from '../../lib/careerChat.js';

const STARTERS = [
  'How do I land my first job?',
  'How should I prepare for interviews?',
  'What do I need to learn for backend?',
  'Where can I find openings that fit me?',
];

/** How long the student can stay quiet after a coach reply before the coach nudges them. */
const IDLE_NUDGE_MS = 20000;

/**
 * Chat with your Mentor — a human-feeling career coach. It reads like a real 1:1 chat
 * with a mentor (bubbles, avatar, typing dots); under the hood the AI answers, and it
 * occasionally drops in a real upcoming live session with a one-tap Enroll.
 */
export function ChatWithMentorPage() {
  const navigate = useNavigate();
  const chat = useCareerChat();
  const send = useSendCareerMessage();
  const enroll = useEnrollSession();
  const nudge = useNudge();
  const { data: profileMe } = useProfile();
  const myAvatar = resolveAvatarUrl(profileMe?.profile?.avatarUrl);

  const [input, setInput] = useState('');
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const messages = chat.data ?? [];
  const coachName = messages.find((m) => m.role === 'mentor')?.authorName ?? 'Arjun Mehta';
  // Show the starter chips only at the very beginning (just the coach's greeting).
  const showStarters = !chat.isLoading && messages.filter((m) => m.role === 'student').length === 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, pendingText, send.isPending, nudge.isPending]);

  // Idle nudge — if the coach spoke last and the student goes quiet (and isn't typing),
  // the coach prods with a follow-up after a short pause, like a real person would. Fires
  // at most once per gap: after it lands there are 2 trailing coach turns, so it won't
  // re-arm until the student replies. The backend double-checks eligibility too.
  useEffect(() => {
    if (chat.isLoading || send.isPending || nudge.isPending || pendingText) return;
    if (input.trim()) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'mentor' || last.kind !== 'text') return;
    if (!messages.some((m) => m.role === 'student')) return;
    let trailing = 0;
    for (let i = messages.length - 1; i >= 0 && messages[i]?.role === 'mentor'; i -= 1) trailing += 1;
    if (trailing >= 2) return;

    const t = setTimeout(() => {
      if (document.visibilityState === 'visible') nudge.mutate();
    }, IDLE_NUDGE_MS);
    return () => clearTimeout(t);
  }, [messages, input, chat.isLoading, send.isPending, pendingText, nudge]);

  async function submit(text?: string) {
    const body = (text ?? input).trim();
    if (!body || send.isPending) return;
    setInput('');
    setPendingText(body);
    try {
      await send.mutateAsync(body);
    } finally {
      setPendingText(null);
    }
  }

  // Enroll, then open the session's watch page.
  async function doEnroll(sessionId: string) {
    setEnrollingId(sessionId);
    try {
      await enroll.mutateAsync(sessionId);
      navigate(`/live-sessions/${sessionId}`);
    } finally {
      setEnrollingId(null);
    }
  }

  return (
    // Mobile: the shell reserves pb-24 (96px) for the bottom nav, but the nav is only
    // ~62px tall — reclaim the excess (-mb-8 + extra height) so the composer hugs the
    // nav instead of floating high above it. Desktop keeps a plain full-height column.
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex h-[calc(100%+1.75rem)] w-full max-w-2xl flex-col -mb-7 md:mb-0 md:h-full"
    >
      <div className="hidden shrink-0 sm:block">
        <PageHeader
          icon={<MessagesSquare />}
          title="Chat with your Mentor"
          subtitle="Ask anything about jobs, interviews, and what to learn — your mentor is here to help."
        />
      </div>

      {/* Coach header — makes it read as a real person, not a bot */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border-subtle pb-3 pt-3 sm:mt-5 sm:pt-0">
        <Avatar size="md" name={coachName} online />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{coachName}</div>
          <div className="text-xs text-accent-green">Career Mentor · usually replies in a moment</div>
        </div>
      </div>

      {/* Messages — the only region that scrolls */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 pr-1">
          {chat.isLoading ? (
            <div className="grid h-full place-items-center text-sm text-ink-muted">Loading your chat…</div>
          ) : (
            <>
              {messages.map((m) =>
                m.kind === 'session-invite' && m.session ? (
                  <InviteBubble
                    key={m.id}
                    text={m.body}
                    coachName={coachName}
                    session={m.session}
                    pending={enrollingId === m.session.id}
                    onEnroll={() => m.session && doEnroll(m.session.id)}
                    onOpen={() => m.session && navigate(`/live-sessions/${m.session.id}`)}
                  />
                ) : (
                  <MessageBubble
                    key={m.id}
                    mine={m.role === 'student'}
                    body={m.body}
                    coachName={coachName}
                    myAvatar={myAvatar}
                  />
                ),
              )}

              {/* Optimistic echo of the message being sent + the coach "typing" */}
              {pendingText ? (
                <MessageBubble mine body={pendingText} coachName={coachName} myAvatar={myAvatar} />
              ) : null}
              {send.isPending || nudge.isPending ? <TypingBubble coachName={coachName} /> : null}
            </>
          )}
          <div ref={endRef} />
        </div>

        {/* Starter chips */}
        {showStarters ? (
          <div className="flex shrink-0 flex-wrap gap-2 pb-3">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-medium text-ink ring-1 ring-border-subtle transition hover:ring-border-strong"
              >
                <Sparkles className="size-3.5 text-accent-amber" />
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {/* Composer — pinned above the mobile bottom nav (the shell reserves the space) */}
        <div className="flex shrink-0 items-center gap-2 border-t border-border-subtle py-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Message your mentor…"
            className="auth-input-plain h-11 flex-1"
          />
          <button
            type="button"
            onClick={() => submit()}
            disabled={!input.trim() || send.isPending}
            className="grid size-11 shrink-0 place-items-center rounded-md bg-accent-blue text-white transition hover:brightness-110 disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="size-4" />
          </button>
        </div>
    </motion.div>
  );
}

function MessageBubble({
  mine,
  body,
  coachName,
  myAvatar,
}: {
  mine: boolean;
  body: string;
  coachName: string;
  myAvatar?: string;
}) {
  return (
    <div className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
      {!mine ? <Avatar size="sm" name={coachName} /> : null}
      <div
        className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
          mine
            ? 'rounded-br-md bg-white text-black ring-1 ring-border-subtle'
            : 'rounded-bl-md bg-surface-sunken text-ink'
        }`}
      >
        {body}
      </div>
      {mine ? <Avatar size="sm" src={myAvatar} name="You" /> : null}
    </div>
  );
}

function TypingBubble({ coachName }: { coachName: string }) {
  return (
    <div className="flex items-end gap-2">
      <Avatar size="sm" name={coachName} />
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-surface-sunken px-4 py-3">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-bounce rounded-full bg-ink-faint"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/** A live-session recommendation, attributed to the real host, with a one-tap Enroll. */
function InviteBubble({
  text,
  coachName,
  session,
  pending,
  onEnroll,
  onOpen,
}: {
  text: string;
  coachName: string;
  session: CareerChatSessionCard;
  pending: boolean;
  onEnroll: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-end gap-2">
      <Avatar size="sm" name={coachName} />
      <div className="max-w-[85%] space-y-2">
        <div className="rounded-2xl rounded-bl-md bg-surface-sunken px-3.5 py-2.5 text-sm leading-6 text-ink">
          {text}
        </div>

        <div className="overflow-hidden rounded-xl bg-surface ring-1 ring-border">
          <div className="flex items-center gap-2.5 border-b border-border-subtle px-3.5 py-2.5">
            <Avatar size="sm" src={resolveAvatarUrl(session.mentorAvatarUrl)} name={session.mentorName} />
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-ink">{session.mentorName}</div>
              <div className="text-[11px] uppercase tracking-wide text-accent-green">Live session</div>
            </div>
          </div>

          <div className="px-3.5 py-3">
            <div className="text-sm font-semibold text-ink">{session.title}</div>
            <div className="mt-0.5 text-xs text-ink-muted">{session.topic}</div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" />
                {formatWhen(session.scheduledFor)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart className="size-3.5" />
                {session.likeCount}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="size-3.5" />
                {session.chatCount}
              </span>
            </div>

            <button
              type="button"
              onClick={session.enrolled ? onOpen : onEnroll}
              disabled={pending}
              className={`mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-semibold transition disabled:opacity-60 ${
                session.enrolled
                  ? 'bg-surface-sunken text-accent-green ring-1 ring-border-subtle hover:ring-border-strong'
                  : 'bg-accent-blue text-white hover:brightness-110'
              }`}
            >
              {session.enrolled ? (
                <>
                  <Check className="size-4" /> Enrolled
                </>
              ) : pending ? (
                'Enrolling…'
              ) : (
                'Enroll'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'Time to be announced';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Time to be announced';
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
