import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Phone, PhoneCall } from 'lucide-react';
import { Badge, Card } from '@mentra/ui';
import type { LeadCallStatus, LeadStatus, LeadView } from '@mentra/shared';
import { PageHeader } from '../../components/PageHeader.js';
import { ApiError } from '../../lib/api.js';
import { useCallLead, useLead, useLeadCallHistory } from '../../lib/leads.js';

const STATUS_TONE: Record<LeadStatus, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  new: 'default',
  contacted: 'info',
  qualified: 'info',
  proposal: 'warning',
  won: 'success',
  lost: 'danger',
};

const CALL_TONE: Record<LeadCallStatus, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  queued: 'default',
  ringing: 'warning',
  'in-progress': 'info',
  ended: 'success',
  failed: 'danger',
};

const fullName = (l: LeadView) => [l.firstName, l.lastName].filter(Boolean).join(' ') || l.email || l.phone || 'Unnamed lead';

export function LeadDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const lead = useLead(id);
  const calls = useLeadCallHistory(id);
  const call = useCallLead();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCall() {
    setNotice(null);
    setError(null);
    try {
      await call.mutateAsync({ leadId: id, input: {} });
      setNotice('Call placed. Watch its status below.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not place the call.');
    }
  }

  if (lead.isLoading) return <div className="grid min-h-[40vh] place-items-center text-ink-muted">Loading…</div>;
  if (lead.isError || !lead.data) {
    return (
      <div className="mx-auto grid min-h-[40vh] max-w-md place-items-center text-center">
        <div>
          <h2 className="text-display-sm tracking-normal">Lead not found</h2>
          <button type="button" onClick={() => navigate('/leads')} className="mt-4 h-10 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse hover:bg-ink">
            Back to leads
          </button>
        </div>
      </div>
    );
  }

  const l = lead.data;
  const hasPhone = Boolean(l.phone && l.phone.trim());

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 py-2">
      <button type="button" onClick={() => navigate('/leads')} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Leads
      </button>

      <PageHeader
        icon={<Phone />}
        title={fullName(l)}
        subtitle={[l.jobTitle, l.company].filter(Boolean).join(' · ') || undefined}
        actions={
          <button
            type="button"
            onClick={handleCall}
            disabled={!hasPhone || call.isPending}
            title={hasPhone ? 'Place an AI call to this lead' : 'Add a phone number first'}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-surface-inverse px-4 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
          >
            <PhoneCall className="size-4" />
            {call.isPending ? 'Calling…' : 'Call with AI'}
          </button>
        }
      />

      {!hasPhone ? (
        <div className="rounded-md bg-accent-amber/10 px-4 py-3 text-sm text-accent-amber ring-1 ring-accent-amber/30">
          This lead has no phone number. Add one (E.164, e.g. +14155551234) to enable AI calling.
        </div>
      ) : null}
      {notice ? <div className="rounded-md bg-surface px-4 py-3 text-sm text-ink-muted ring-1 ring-border-subtle">{notice}</div> : null}
      {error ? <div className="rounded-md bg-accent-red/10 px-4 py-3 text-sm text-accent-red ring-1 ring-accent-red/30">{error}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Details */}
        <Card interactive={false} className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_TONE[l.status]}>{l.status}</Badge>
            {l.source ? <Badge variant="outline">{l.source}</Badge> : null}
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Detail label="Email" value={l.email} />
            <Detail label="Phone" value={l.phone} />
            <Detail label="Company" value={l.company} />
            <Detail label="Job title" value={l.jobTitle} />
            <Detail label="Deal value" value={l.value != null ? String(l.value) : null} />
            <Detail label="Location" value={[l.city, l.country].filter(Boolean).join(', ') || null} />
            <Detail label="Timezone" value={l.timezone} />
            <Detail label="Last contacted" value={l.lastContactedAt ? new Date(l.lastContactedAt).toLocaleString() : null} />
            <Detail label="Website" value={l.website} link />
            <Detail label="LinkedIn" value={l.linkedinUrl} link />
          </dl>
          {l.tags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {l.tags.map((t) => (
                <span key={t} className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs text-ink-muted ring-1 ring-border-subtle">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          {l.notes ? (
            <div>
              <div className="mb-1 text-xs font-medium text-ink-faint">Notes</div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-ink-muted">{l.notes}</p>
            </div>
          ) : null}
        </Card>

        {/* Call history */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink">Call history</h2>
          {calls.isLoading ? (
            <div className="text-sm text-ink-muted">Loading…</div>
          ) : (calls.data ?? []).length === 0 ? (
            <Card className="py-8 text-center text-sm text-ink-muted">No calls yet.</Card>
          ) : (
            <div className="space-y-2">
              {(calls.data ?? []).map((c) => (
                <Card key={c.id} interactive={false} className="space-y-1.5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-faint">{new Date(c.createdAt).toLocaleString()}</span>
                    <Badge variant={CALL_TONE[c.status]}>{c.status}</Badge>
                  </div>
                  {c.summary ? <p className="text-sm leading-6 text-ink-muted">{c.summary}</p> : null}
                  {c.endedReason ? <p className="text-xs text-ink-faint">{c.endedReason}</p> : null}
                  {c.recordingUrl ? (
                    <a href={c.recordingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
                      Recording <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, link }: { label: string; value: string | null; link?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">
        {value ? (
          link ? (
            <a href={value} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink hover:text-ink-muted">
              {value} <ExternalLink className="size-3" />
            </a>
          ) : (
            (value as ReactNode)
          )
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </dd>
    </div>
  );
}
