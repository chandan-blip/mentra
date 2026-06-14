import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { ImagePlus, Send, Smile, X } from 'lucide-react';
import { useSearchMembers } from '../lib/community.js';

/**
 * Reusable rich text composer for the community feed: plain textarea plus an emoji
 * palette, @mention autocomplete, and an optional image/GIF URL attachment. Emits a
 * value object; mentions are collected as userIds for the API.
 */

export type ComposerValue = {
  body: string;
  mediaUrl: string | null;
  mediaType: 'image' | 'gif' | null;
  mentions: string[];
};

const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😎', '🤔', '😉', '🙌',
  '👍', '👏', '🔥', '🎉', '🚀', '💡', '✅', '❤️', '💯', '🙏',
  '😅', '😭', '😡', '🥳', '🤝', '👀', '💪', '⭐', '☕', '🐛',
];

/** XSS-safe render: text nodes + highlighted @mentions + linkified URLs. */
export function renderRichText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(@[A-Za-z0-9_]+)|(https?:\/\/[^\s]+)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1]) {
      nodes.push(
        <span key={key++} className="font-medium text-accent-blue">
          {m[1]}
        </span>,
      );
    } else {
      nodes.push(
        <a key={key++} href={m[2]} target="_blank" rel="noreferrer" className="text-accent-blue underline break-all">
          {m[2]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function RichComposer({
  placeholder = 'Share something with the community…',
  submitLabel = 'Post',
  withMedia = true,
  autoFocus,
  pending,
  initial,
  onSubmit,
  onCancel,
}: {
  placeholder?: string;
  submitLabel?: string;
  withMedia?: boolean;
  autoFocus?: boolean;
  pending?: boolean;
  initial?: Partial<ComposerValue>;
  onSubmit: (v: ComposerValue) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState(initial?.body ?? '');
  const [mediaUrl, setMediaUrl] = useState<string | null>(initial?.mediaUrl ?? null);
  const [mediaType, setMediaType] = useState<'image' | 'gif' | null>(initial?.mediaType ?? null);
  const [mentions, setMentions] = useState<string[]>(initial?.mentions ?? []);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const members = useSearchMembers(mentionQuery ?? '');

  function refreshMentionQuery(value: string, caret: number) {
    const before = value.slice(0, caret);
    const m = before.match(/(?:^|\s)@(\w{0,30})$/);
    setMentionQuery(m ? (m[1] ?? null) : null);
  }

  function onChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setBody(e.target.value);
    refreshMentionQuery(e.target.value, e.target.selectionStart ?? e.target.value.length);
  }

  function insertAtCaret(text: string) {
    const el = ref.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    const next = body.slice(0, start) + text + body.slice(end);
    setBody(next);
    setTimeout(() => {
      el?.focus();
      const pos = start + text.length;
      el?.setSelectionRange(pos, pos);
    }, 0);
  }

  function pickMention(member: { id: string; name: string }) {
    const el = ref.current;
    const caret = el?.selectionStart ?? body.length;
    const before = body.slice(0, caret);
    const replaced = before.replace(/@(\w{0,30})$/, `@${member.name} `);
    const next = replaced + body.slice(caret);
    setBody(next);
    setMentions((prev) => (prev.includes(member.id) ? prev : [...prev, member.id]));
    setMentionQuery(null);
    setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(replaced.length, replaced.length);
    }, 0);
  }

  function applyMediaUrl(url: string) {
    const clean = url.trim();
    if (!clean) {
      setMediaUrl(null);
      setMediaType(null);
      return;
    }
    setMediaUrl(clean);
    setMediaType(/\.gif($|\?)/i.test(clean) ? 'gif' : 'image');
  }

  const canSubmit = (body.trim().length > 0 || !!mediaUrl) && !pending;

  async function submit() {
    if (!canSubmit) return;
    await onSubmit({ body: body.trim(), mediaUrl, mediaType, mentions });
    if (!onCancel) {
      // Composer (not edit mode) — reset for the next message.
      setBody('');
      setMediaUrl(null);
      setMediaType(null);
      setMentions([]);
      setMediaOpen(false);
      setEmojiOpen(false);
    }
  }

  return (
    <div className="rounded-lg bg-surface-raised ring-1 ring-border-subtle">
      <textarea
        ref={ref}
        value={body}
        onChange={onChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        autoFocus={autoFocus}
        rows={3}
        placeholder={placeholder}
        className="block w-full resize-none rounded-t-lg bg-transparent px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint"
      />

      {/* @mention autocomplete */}
      {mentionQuery !== null && (members.data?.length ?? 0) > 0 ? (
        <div className="mx-3 mb-2 overflow-hidden rounded-md bg-surface-sunken ring-1 ring-border-subtle">
          {members.data!.slice(0, 6).map((mem) => (
            <button
              key={mem.id}
              type="button"
              onClick={() => pickMention(mem)}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-surface-raised"
            >
              <span className="font-medium text-ink">{mem.name}</span>
              <span className="text-ink-faint capitalize">{mem.role}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* media attachment */}
      {mediaOpen && withMedia ? (
        <div className="px-3 pb-2">
          <input
            value={mediaUrl ?? ''}
            onChange={(e) => applyMediaUrl(e.target.value)}
            placeholder="Paste an image or GIF URL…"
            className="auth-input-plain h-9 w-full text-xs"
          />
        </div>
      ) : null}
      {mediaUrl ? (
        <div className="px-3 pb-2">
          <div className="relative inline-block">
            <img src={mediaUrl} alt="attachment" className="max-h-40 rounded-md ring-1 ring-border-subtle" />
            <button
              type="button"
              onClick={() => applyMediaUrl('')}
              aria-label="Remove media"
              className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {/* emoji palette */}
      {emojiOpen ? (
        <div className="mx-3 mb-2 flex flex-wrap gap-1 rounded-md bg-surface-sunken p-2 ring-1 ring-border-subtle">
          {EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => insertAtCaret(e)} className="grid size-7 place-items-center rounded text-lg transition hover:bg-surface-raised">
              {e}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-border-subtle px-2 py-1.5">
        <div className="flex items-center gap-1">
          <ToolButton active={emojiOpen} onClick={() => setEmojiOpen((v) => !v)} label="Emoji">
            <Smile className="size-4" />
          </ToolButton>
          {withMedia ? (
            <ToolButton active={mediaOpen} onClick={() => setMediaOpen((v) => !v)} label="Add image or GIF">
              <ImagePlus className="size-4" />
            </ToolButton>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {onCancel ? (
            <button type="button" onClick={onCancel} className="h-8 rounded-md px-3 text-xs font-medium text-ink-muted transition hover:text-ink">
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="flex h-8 items-center gap-1.5 rounded-md bg-accent-blue px-3 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            <Send className="size-3.5" /> {pending ? 'Posting…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid size-8 place-items-center rounded-md transition ${
        active ? 'bg-accent-blue/10 text-accent-blue' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
