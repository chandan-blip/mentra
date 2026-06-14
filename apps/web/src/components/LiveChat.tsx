import { useEffect, useRef, useState } from 'react';
import { Check, Hand, Send } from 'lucide-react';
import { Card } from '@mentra/ui';
import type { ChatMessageView } from '@mentra/shared';
import type { RaisedHand } from '../lib/socket.js';

/**
 * Live chat panel shared by the student viewer and the mentor broadcaster. Fully
 * controlled — messages stream in over Socket.IO and every send is persisted
 * server-side. When `hands`/`onApprove` are passed (mentor side) it also surfaces
 * raise-hand requests with an approve action.
 */
export function LiveChat({
  messages,
  selfUserId,
  onSend,
  hands,
  onApprove,
  connected = true,
}: {
  messages: ChatMessageView[];
  selfUserId: string | null;
  onSend: (body: string) => void;
  hands?: RaisedHand[];
  onApprove?: (userId: string) => void;
  connected?: boolean;
}) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <Card className="flex h-[60vh] flex-col p-0 lg:h-auto">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <span className="text-sm font-medium text-ink">Live chat</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
          <span className={`size-1.5 rounded-full ${connected ? 'bg-accent-green' : 'bg-ink-faint'}`} />
          {connected ? 'Connected' : 'Connecting…'}
        </span>
      </div>

      {hands && hands.length > 0 ? (
        <div className="border-b border-border-subtle bg-surface-sunken px-4 py-2.5">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
            Raised hands
          </div>
          <div className="space-y-1.5">
            {hands.map((h) => (
              <div key={h.userId} className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm text-ink">
                  <Hand className="size-3.5 text-accent-amber" /> {h.name}
                </span>
                <button
                  type="button"
                  onClick={() => onApprove?.(h.userId)}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-accent-green/15 px-2.5 text-xs font-medium text-accent-green ring-1 ring-accent-green/30 transition hover:bg-accent-green/25"
                >
                  <Check className="size-3.5" /> Let speak
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex-1 space-y-2.5 overflow-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-ink-faint">No messages yet — say hi 👋</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="text-sm">
              <span className={`font-medium ${m.authorUserId === selfUserId ? 'text-accent-green' : 'text-ink'}`}>
                {m.authorUserId === selfUserId ? 'You' : m.authorName}
              </span>{' '}
              <span className="text-ink-muted">{m.body}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onSend(text);
          setText('');
        }}
        className="flex items-center gap-2 border-t border-border-subtle p-3"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say something…"
          maxLength={1000}
          className="auth-input-plain h-9 flex-1"
        />
        <button
          type="submit"
          className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-inverse text-ink-inverse transition hover:bg-ink"
        >
          <Send className="size-4" />
        </button>
      </form>
    </Card>
  );
}
