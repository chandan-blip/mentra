import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, Phone, PhoneCall, Sparkles } from 'lucide-react';
import { Badge, Card } from '@mentra/ui';
import type { LeadCallStatus } from '@mentra/shared';
import { PageHeader } from '../../components/PageHeader.js';
import { ApiError } from '../../lib/api.js';
import { useLeadCalls, useLeadLists, useListMembers, useStartCallRun } from '../../lib/leads.js';

const CALL_TONE: Record<LeadCallStatus, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  queued: 'default',
  ringing: 'warning',
  'in-progress': 'info',
  ended: 'success',
  failed: 'danger',
};

/**
 * AI Assistant — drive outbound AI phone calls (via Vapi) against a lead list.
 * Pick a list, launch a calling run, and watch results stream in as the Vapi
 * webhook updates each call's status, summary and recording.
 */
export function AiAssistantPage() {
  const [params, setParams] = useSearchParams();
  const lists = useLeadLists();
  const [listId, setListId] = useState<string | null>(params.get('list'));
  const members = useListMembers(listId);
  const calls = useLeadCalls(listId ?? undefined);
  const start = useStartCallRun();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Default to the first list once loaded (if none preselected via ?list=).
  useEffect(() => {
    if (!listId && lists.data && lists.data.length > 0) setListId(lists.data[0]!.id);
  }, [lists.data, listId]);

  const callable = useMemo(() => (members.data ?? []).filter((m) => m.phone && m.phone.trim()).length, [members.data]);
  const selectedList = lists.data?.find((l) => l.id === listId) ?? null;

  function selectList(id: string) {
    setListId(id);
    setParams(id ? { list: id } : {});
    setNotice(null);
    setError(null);
  }

  async function launch() {
    if (!listId) return;
    setNotice(null);
    setError(null);
    try {
      const res = await start.mutateAsync({ listId, input: {} });
      const parts = [`${res.queued} call(s) queued`];
      if (res.skippedNoPhone) parts.push(`${res.skippedNoPhone} skipped (no phone)`);
      if (res.skippedCap) parts.push(`${res.skippedCap} over the per-run cap`);
      setNotice(parts.join(' · '));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start the calling run.');
    }
  }

  return (
    <div className="mx-auto w-full max-w-8xl space-y-6 py-2">
      <PageHeader
        icon={<Sparkles />}
        title="AI Assistant"
        subtitle="Place outbound AI phone calls to a lead list using Vapi, and review the results."
      />

      <Card interactive={false} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Lead list</span>
            <select
              value={listId ?? ''}
              onChange={(e) => selectList(e.target.value)}
              className="h-10 w-full rounded-md bg-surface-sunken px-3 text-sm text-ink ring-1 ring-border-subtle outline-none focus:ring-border-strong"
            >
              <option value="" disabled>
                {lists.isLoading ? 'Loading…' : 'Select a list'}
              </option>
              {(lists.data ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.memberCount})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={launch}
            disabled={!listId || callable === 0 || start.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
          >
            <PhoneCall className="size-4" />
            {start.isPending ? 'Starting…' : 'Start AI calls'}
          </button>
        </div>

        {selectedList ? (
          <div className="flex flex-wrap gap-4 text-sm text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="size-4" /> {callable} callable of {selectedList.memberCount} in “{selectedList.name}”
            </span>
            {callable === 0 ? <span className="text-accent-amber">No leads in this list have a phone number.</span> : null}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">
            Create a list and add leads with phone numbers (E.164, e.g. +14155551234) on the Leads page first.
          </p>
        )}

        {notice ? <div className="rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink-muted ring-1 ring-border-subtle">{notice}</div> : null}
        {error ? <div className="rounded-md bg-accent-red/10 px-3 py-2 text-sm text-accent-red ring-1 ring-accent-red/30">{error}</div> : null}
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink">Recent calls</h2>
        {calls.isLoading ? (
          <div className="grid min-h-[20vh] place-items-center text-ink-muted">Loading…</div>
        ) : (calls.data ?? []).length === 0 ? (
          <Card className="py-10 text-center text-ink-muted">No calls yet for this list.</Card>
        ) : (
          <div className="space-y-2">
            {(calls.data ?? []).map((call) => (
              <Card key={call.id} interactive={false} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-ink">{call.leadName}</span>
                  <Badge variant={CALL_TONE[call.status]}>{call.status}</Badge>
                </div>
                {call.summary ? <p className="text-sm leading-6 text-ink-muted">{call.summary}</p> : null}
                <div className="flex items-center gap-4 text-xs text-ink-faint">
                  <span>{new Date(call.createdAt).toLocaleString()}</span>
                  {call.endedReason ? <span>· {call.endedReason}</span> : null}
                  {call.recordingUrl ? (
                    <a href={call.recordingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink-muted hover:text-ink">
                      Recording <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
