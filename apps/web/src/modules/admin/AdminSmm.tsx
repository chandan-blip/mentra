import { useEffect, useState } from 'react';
import { Loader2, RotateCcw, Send, Trash2 } from 'lucide-react';
import { Card } from '@mentra/ui';
import { Switch } from '../../components/Switch.js';
import {
  useDeleteQueueItem,
  useOrderPost,
  useRetryQueueItem,
  useSaveSmmConfig,
  useSetWebhookEnabled,
  useSmm,
  type SmmConfig,
  type SmmQueueItem,
} from '../../lib/smm.js';

/**
 * SMM Orders (admin). Configures the SMM panel and shows the order queue.
 *
 * How an order happens: you post in a Telegram channel registered with purpose "SMM"
 * (Telegram page) → Telegram's webhook hits the API → the post is queued once (deduped on
 * its URL) → a single paced worker places the views/reactions orders. The master switch
 * below gates that whole path and starts OFF.
 */
export function AdminSmmPage() {
  const { data, isLoading } = useSmm();
  const setWebhook = useSetWebhookEnabled();

  return (
    <div className="mx-auto w-full max-w-8xl">
      <h1 className="text-display-sm tracking-normal md:text-display-md">SMM Orders</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Auto-order views &amp; reactions on posts made in your SMM Telegram channel.
      </p>

      {isLoading || !data ? (
        <p className="mt-6 text-sm text-ink-muted">Loading…</p>
      ) : (
        <>
          <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">Auto-order on channel posts</h2>
              <p className="mt-1 text-xs text-ink-muted">
                When off, posts are ignored entirely — nothing is queued and no panel balance is spent.
              </p>
            </div>
            <Switch
              checked={data.webhookEnabled}
              onChange={(enabled) => setWebhook.mutate(enabled)}
              label={data.webhookEnabled ? 'On' : 'Off'}
            />
          </Card>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
            <div className="grid gap-6">
              <PanelConfigCard config={data.config} />
              <ManualOrderCard />
            </div>
            <QueueList items={data.queue} counts={data.counts} />
          </div>
        </>
      )}
    </div>
  );
}

function PanelConfigCard({ config }: { config: SmmConfig }) {
  const save = useSaveSmmConfig();
  const [form, setForm] = useState(config);
  // Left blank on purpose: the server never returns the stored key, and an empty submit
  // keeps it. Typing here is the only way to replace it.
  const [apiKey, setApiKey] = useState('');
  const [note, setNote] = useState<string | null>(null);
  // The overview polls every 15s and hands back a NEW config object each time. Without
  // this guard the sync effect below would overwrite whatever the admin is mid-way
  // through typing or toggling — edits would silently revert seconds after being made.
  const [dirty, setDirty] = useState(false);

  // Adopt server state only while the form is untouched (first load, or someone else saved).
  useEffect(() => {
    if (!dirty) setForm(config);
  }, [config, dirty]);

  function set<K extends keyof SmmConfig>(key: K, value: SmmConfig[K]) {
    setDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /**
   * The master switch persists on toggle — a switch that needs a separate Save to take
   * effect reads as broken, and it matches the webhook switch at the top of the page.
   * Only `enabled` is sent: saveConfig merges a partial over the STORED config, so a
   * half-typed API URL sitting in the form can't ride along.
   */
  function toggleEnabled(enabled: boolean) {
    setForm((prev) => ({ ...prev, enabled }));
    setNote(null);
    save.mutate(
      { enabled },
      {
        onSuccess: () => setNote(enabled ? 'Panel enabled.' : 'Panel disabled.'),
        onError: (err: unknown) => {
          setForm((prev) => ({ ...prev, enabled: !enabled })); // revert the optimistic flip
          setNote(err instanceof Error ? err.message : 'Could not save');
        },
      },
    );
  }

  function submit() {
    setNote(null);
    const { apiKeySet: _ignored, ...rest } = form;
    save.mutate(
      { ...rest, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) },
      {
        onSuccess: () => {
          setApiKey('');
          setDirty(false); // let the poll drive the form again
          setNote('Saved.');
        },
        onError: (err: unknown) => setNote(err instanceof Error ? err.message : 'Could not save'),
      },
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Panel</h2>
        <Switch checked={form.enabled} onChange={toggleEnabled} label="Enabled" />
      </div>

      <label className="mt-4 block text-xs font-medium text-ink-muted">API URL</label>
      <input
        className="mt-1 w-full rounded-lg bg-surface-sunken px-3 py-2 text-sm text-ink ring-1 ring-border-subtle"
        placeholder="https://yourpanel.com/api/v2"
        value={form.apiUrl}
        onChange={(e) => set('apiUrl', e.target.value)}
      />

      <label className="mt-3 block text-xs font-medium text-ink-muted">
        API key {form.apiKeySet ? <span className="text-ink-faint">(set — leave blank to keep)</span> : null}
      </label>
      <input
        type="password"
        autoComplete="off"
        className="mt-1 w-full rounded-lg bg-surface-sunken px-3 py-2 text-sm text-ink ring-1 ring-border-subtle"
        placeholder={form.apiKeySet ? '••••••••' : 'Panel API key'}
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />

      <ServiceFields
        title="Views"
        enabled={form.viewsEnabled}
        serviceId={form.viewsServiceId}
        quantity={form.viewsQuantity}
        onEnabled={(v) => set('viewsEnabled', v)}
        onServiceId={(v) => set('viewsServiceId', v)}
        onQuantity={(v) => set('viewsQuantity', v)}
      />
      <ServiceFields
        title="Reactions"
        enabled={form.reactionsEnabled}
        serviceId={form.reactionsServiceId}
        quantity={form.reactionsQuantity}
        onEnabled={(v) => set('reactionsEnabled', v)}
        onServiceId={(v) => set('reactionsServiceId', v)}
        onQuantity={(v) => set('reactionsQuantity', v)}
      />

      {note ? <p className="mt-3 text-sm text-ink-muted">{note}</p> : null}

      <button
        type="button"
        onClick={submit}
        disabled={save.isPending}
        className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-surface-inverse px-4 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        Save panel settings
      </button>
    </Card>
  );
}

function ServiceFields({
  title,
  enabled,
  serviceId,
  quantity,
  onEnabled,
  onServiceId,
  onQuantity,
}: {
  title: string;
  enabled: boolean;
  serviceId: string;
  quantity: number;
  onEnabled: (v: boolean) => void;
  onServiceId: (v: string) => void;
  onQuantity: (v: number) => void;
}) {
  return (
    <div className="mt-4 rounded-lg bg-surface-sunken p-3 ring-1 ring-border-subtle">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink">{title}</span>
        <Switch checked={enabled} onChange={onEnabled} label={enabled ? 'On' : 'Off'} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-ink-muted">Service id</label>
          <input
            className="mt-1 w-full rounded-lg bg-surface px-3 py-2 text-sm text-ink ring-1 ring-border-subtle"
            placeholder="1234"
            value={serviceId}
            onChange={(e) => onServiceId(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-muted">Quantity</label>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg bg-surface px-3 py-2 text-sm text-ink ring-1 ring-border-subtle"
            value={quantity}
            onChange={(e) => onQuantity(Number(e.target.value) || 0)}
          />
        </div>
      </div>
    </div>
  );
}

function ManualOrderCard() {
  const order = useOrderPost();
  const [postUrl, setPostUrl] = useState('');
  const [note, setNote] = useState<string | null>(null);

  function submit() {
    setNote(null);
    order.mutate(postUrl, {
      onSuccess: (res) => {
        setPostUrl('');
        setNote(res.queued ? 'Queued.' : 'Already queued — skipped (no double order).');
      },
      onError: (err: unknown) => setNote(err instanceof Error ? err.message : 'Could not queue'),
    });
  }

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-ink">Order on a specific post</h2>
      <p className="mt-1 text-xs text-ink-muted">
        Paste a t.me post link to queue it manually. Re-queuing the same link is a no-op.
      </p>
      <input
        className="mt-3 w-full rounded-lg bg-surface-sunken px-3 py-2 text-sm text-ink ring-1 ring-border-subtle"
        placeholder="https://t.me/yourchannel/123"
        value={postUrl}
        onChange={(e) => setPostUrl(e.target.value)}
      />
      {note ? <p className="mt-3 text-sm text-ink-muted">{note}</p> : null}
      <button
        type="button"
        onClick={submit}
        disabled={order.isPending || postUrl.trim().length === 0}
        className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-surface-inverse px-4 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {order.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Queue order
      </button>
    </Card>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600',
  processing: 'bg-sky-500/10 text-sky-600',
  done: 'bg-emerald-500/10 text-emerald-600',
  failed: 'bg-rose-500/10 text-rose-600',
};

function QueueList({ items, counts }: { items: SmmQueueItem[]; counts: Record<string, number> }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-ink">Queue</h2>
        {Object.entries(counts).map(([status, n]) => (
          <span
            key={status}
            className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_STYLES[status] ?? 'bg-surface-sunken text-ink-muted'}`}
          >
            {status} {n}
          </span>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl bg-surface-sunken py-12 text-center text-sm text-ink-muted ring-1 ring-border-subtle">
          Nothing queued yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <QueueRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function QueueRow({ item }: { item: SmmQueueItem }) {
  const retry = useRetryQueueItem();
  const remove = useDeleteQueueItem();

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={item.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-sm font-medium text-ink underline-offset-2 hover:underline"
          >
            {item.postUrl}
          </a>
          <p className="mt-1 text-xs text-ink-faint">
            {item.contextLabel} · attempt {item.attempts} · {item.placed} order{item.placed === 1 ? '' : 's'} placed
            {item.viewsOrderId ? ` · views #${item.viewsOrderId}` : ''}
            {item.reactionsOrderId ? ` · reactions #${item.reactionsOrderId}` : ''}
          </p>
          {item.lastError ? (
            // A `done` row with nothing placed was SKIPPED (panel off, no credentials, no
            // services) — lastError holds the reason, not a fault. Red would read as a
            // failure and send someone hunting a bug that isn't there.
            <p
              className={`mt-1 text-xs ${
                item.status === 'done' && item.placed === 0 ? 'text-ink-faint' : 'text-rose-500'
              }`}
            >
              {item.status === 'done' && item.placed === 0 ? `Skipped: ${item.lastError}` : item.lastError}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_STYLES[item.status] ?? 'bg-surface-sunken text-ink-muted'}`}
          >
            {item.status}
          </span>
          <button
            type="button"
            onClick={() => retry.mutate(item.id)}
            disabled={retry.isPending || item.status === 'pending' || item.status === 'processing'}
            title="Retry"
            className="rounded-lg p-2 text-ink-muted ring-1 ring-border-subtle hover:text-ink disabled:opacity-40"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => remove.mutate(item.id)}
            disabled={remove.isPending}
            title="Remove"
            className="rounded-lg p-2 text-rose-500 ring-1 ring-border-subtle hover:bg-rose-500/10 disabled:opacity-50"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </Card>
  );
}
