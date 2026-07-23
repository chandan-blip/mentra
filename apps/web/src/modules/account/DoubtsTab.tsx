import { useState } from 'react';
import { MessagesSquare, Send } from 'lucide-react';
import { Card } from '@mentra/ui';
import type { MentorThreadView } from '@mentra/shared';
import { getStoredUser } from '../../lib/auth.js';
import { avatarBg, hueOf, useMyThreads, useSendDoubt, useThreadMessages } from '../../lib/mentors.js';
import { Modal, initials } from '../student/Mentors.js';

/**
 * "Doubts" settings tab — the student's async Q&A threads with mentors. Moved here from the
 * Mentors page; owns its own open-thread state and renders the conversation modal.
 */

export function DoubtsTab() {
  const [openThread, setOpenThread] = useState<MentorThreadView | null>(null);
  return (
    <>
      <DoubtsList onOpen={setOpenThread} />
      {openThread ? <ThreadModal thread={openThread} onClose={() => setOpenThread(null)} /> : null}
    </>
  );
}

function DoubtsList({ onOpen }: { onOpen: (t: MentorThreadView) => void }) {
  const threads = useMyThreads();
  if (threads.isLoading) return <Card className="text-sm text-ink-muted">Loading your doubts…</Card>;
  const data = threads.data ?? [];
  if (data.length === 0) {
    return <Card className="text-sm text-ink-muted">No doubts yet — tap “Ask” on a mentor from the Mentors page to start one.</Card>;
  }

  return (
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
