import { useState } from 'react';
import { Loader2, Plus, Send, Trash2 } from 'lucide-react';
import { Card } from '@mentra/ui';
import { Switch } from '../../components/Switch.js';
import {
  useCreateChannel,
  useDeleteChannel,
  useTelegram,
  useTestChannel,
  useUpdateChannel,
  type TelegramChannel,
  type TelegramEvent,
} from '../../lib/telegram.js';

/**
 * Telegram (admin). Registers the chats the bot posts to.
 *
 * Two kinds of channel, distinguished by `purpose`:
 *  - notify — private ops chat; receives event messages (signups, enquiries, support)
 *  - smm    — public channel; posts made there are picked up by the webhook and queued
 *             for SMM orders (configured on the SMM Orders page)
 *
 * The bot token itself is server-side (.env), never entered or shown here.
 */
export function AdminTelegramPage() {
  const { data, isLoading } = useTelegram();

  return (
    <div className="mx-auto w-full max-w-8xl">
      <h1 className="text-display-sm tracking-normal md:text-display-md">Telegram</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Channels the bot posts to. Notification channels receive event alerts; SMM channels are watched by the
        webhook so posts get views &amp; reactions ordered.
      </p>

      {isLoading || !data ? (
        <p className="mt-6 text-sm text-ink-muted">Loading…</p>
      ) : (
        <>
          <SetupCard
            botConfigured={data.botConfigured}
            webhookSecretSet={data.webhookSecretSet}
            webhookUrl={data.webhookUrl}
          />

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
            <AddChannelCard events={data.events} />
            <div>
              <h2 className="mb-3 text-sm font-semibold text-ink">
                Channels <span className="text-ink-faint">({data.channels.length})</span>
              </h2>
              {data.channels.length === 0 ? (
                <div className="rounded-xl bg-surface-sunken py-12 text-center text-sm text-ink-muted ring-1 ring-border-subtle">
                  No channels yet. Add the bot to a chat as an admin, then register its chat id here.
                </div>
              ) : (
                <div className="grid gap-3">
                  {data.channels.map((c) => (
                    <ChannelRow key={c.id} channel={c} events={data.events} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Server-side prerequisites. Both are env vars, so they can only be fixed on the box —
 * showing them here saves an admin from debugging silence when the token is missing.
 */
function SetupCard({
  botConfigured,
  webhookSecretSet,
  webhookUrl,
}: {
  botConfigured: boolean;
  webhookSecretSet: boolean;
  webhookUrl: string;
}) {
  return (
    <Card className="mt-6 p-4">
      <h2 className="text-sm font-semibold text-ink">Server setup</h2>
      <div className="mt-3 grid gap-2 text-sm">
        <StatusLine
          ok={botConfigured}
          label="Bot token"
          okText="TELEGRAM_BOT_TOKEN is set"
          badText="TELEGRAM_BOT_TOKEN is missing — nothing will send"
        />
        <StatusLine
          ok={webhookSecretSet}
          label="Webhook secret"
          okText="TELEGRAM_WEBHOOK_SECRET is set"
          badText="TELEGRAM_WEBHOOK_SECRET is missing — the webhook rejects every call"
        />
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        Point Telegram at this endpoint once (replace the placeholders with your token and secret):
      </p>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-sunken p-3 text-xs text-ink-muted ring-1 ring-border-subtle">
        {`curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \\\n  -d "url=${webhookUrl}" \\\n  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"`}
      </pre>
    </Card>
  );
}

function StatusLine({ ok, label, okText, badText }: { ok: boolean; label: string; okText: string; badText: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`size-2 shrink-0 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      <span className="font-medium text-ink">{label}:</span>
      <span className="text-ink-muted">{ok ? okText : badText}</span>
    </div>
  );
}

function AddChannelCard({ events }: { events: TelegramEvent[] }) {
  const create = useCreateChannel();
  const [label, setLabel] = useState('');
  const [chatId, setChatId] = useState('');
  const [purpose, setPurpose] = useState<'notify' | 'smm'>('notify');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = label.trim().length > 0 && chatId.trim().length > 0 && !create.isPending;

  function submit() {
    setError(null);
    create.mutate(
      {
        label: label.trim(),
        chatId: chatId.trim(),
        purpose,
        // Empty list means "all events" server-side — exactly what an operator expects
        // from ticking nothing.
        events: purpose === 'notify' ? selected : [],
      },
      {
        onSuccess: () => {
          setLabel('');
          setChatId('');
          setSelected([]);
        },
        onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Could not add channel'),
      },
    );
  }

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-ink">Add a channel</h2>
      <p className="mt-1 text-xs text-ink-muted">
        Add the bot to the chat as an <strong>admin</strong> first, post a message there, then read{' '}
        <code>channel_post.chat.id</code> from{' '}
        <code>api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code>.
      </p>

      <label className="mt-4 block text-xs font-medium text-ink-muted">Name</label>
      <input
        className="mt-1 w-full rounded-lg bg-surface-sunken px-3 py-2 text-sm text-ink ring-1 ring-border-subtle"
        placeholder="Ops alerts"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />

      <label className="mt-3 block text-xs font-medium text-ink-muted">Chat id</label>
      <input
        className="mt-1 w-full rounded-lg bg-surface-sunken px-3 py-2 text-sm text-ink ring-1 ring-border-subtle"
        placeholder="-1001234567890 or @mentralive"
        value={chatId}
        onChange={(e) => setChatId(e.target.value)}
      />

      <label className="mt-3 block text-xs font-medium text-ink-muted">Purpose</label>
      <select
        className="mt-1 w-full rounded-lg bg-surface-sunken px-3 py-2 text-sm text-ink ring-1 ring-border-subtle"
        value={purpose}
        onChange={(e) => setPurpose(e.target.value as 'notify' | 'smm')}
      >
        <option value="notify">Notifications — receives event alerts</option>
        <option value="smm">SMM — posts here get views &amp; reactions ordered</option>
      </select>

      {purpose === 'notify' ? (
        <>
          <p className="mt-3 text-xs font-medium text-ink-muted">Events (none selected = all)</p>
          <div className="mt-2 grid gap-2">
            {events.map((e) => (
              <label key={e.key} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={selected.includes(e.key)}
                  onChange={(ev) =>
                    setSelected((prev) => (ev.target.checked ? [...prev, e.key] : prev.filter((k) => k !== e.key)))
                  }
                />
                {e.label}
              </label>
            ))}
          </div>
        </>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-500">{error}</p> : null}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={submit}
        className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-surface-inverse px-4 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Add channel
      </button>
    </Card>
  );
}

function ChannelRow({ channel, events }: { channel: TelegramChannel; events: TelegramEvent[] }) {
  const update = useUpdateChannel();
  const remove = useDeleteChannel();
  const test = useTestChannel();
  const [note, setNote] = useState<string | null>(null);

  const subscribed =
    channel.events.length === 0
      ? 'All events'
      : events
          .filter((e) => channel.events.includes(e.key))
          .map((e) => e.label)
          .join(', ');

  function sendTest() {
    setNote(null);
    test.mutate(channel.id, {
      onSuccess: () => setNote('Test message sent.'),
      onError: (err: unknown) => setNote(err instanceof Error ? err.message : 'Send failed'),
    });
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink">{channel.label}</span>
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-muted ring-1 ring-border-subtle">
              {channel.purpose === 'smm' ? 'SMM' : 'Notifications'}
            </span>
          </div>
          <p className="mt-1 truncate font-mono text-xs text-ink-muted">{channel.chatId}</p>
          {channel.purpose === 'notify' ? <p className="mt-1 text-xs text-ink-faint">{subscribed}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={channel.active}
            onChange={(active) => update.mutate({ id: channel.id, active })}
            label="Active"
          />
          <button
            type="button"
            onClick={sendTest}
            disabled={test.isPending}
            title="Send a test message"
            className="rounded-lg p-2 text-ink-muted ring-1 ring-border-subtle hover:text-ink disabled:opacity-50"
          >
            {test.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => remove.mutate(channel.id)}
            disabled={remove.isPending}
            title="Remove channel"
            className="rounded-lg p-2 text-rose-500 ring-1 ring-border-subtle hover:bg-rose-500/10 disabled:opacity-50"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      {note ? <p className="mt-3 text-xs text-ink-muted">{note}</p> : null}
    </Card>
  );
}
