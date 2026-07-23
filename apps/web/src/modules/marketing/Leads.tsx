import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListPlus, Mail, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { Badge, Card } from '@mentra/ui';
import type { CreateLeadInput, LeadStatus, LeadView } from '@mentra/shared';
import { ApiError } from '../../lib/api.js';
import {
  useAddToList,
  useCreateLead,
  useCreateList,
  useDeleteLead,
  useDeleteList,
  useLeadLists,
  useLeads,
  useListMembers,
  useRemoveFromList,
  useSendListEmail,
  useUpdateLead,
} from '../../lib/leads.js';

const STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
const STATUS_TONE: Record<LeadStatus, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  new: 'default',
  contacted: 'info',
  qualified: 'info',
  proposal: 'warning',
  won: 'success',
  lost: 'danger',
};

const fullName = (l: LeadView) => [l.firstName, l.lastName].filter(Boolean).join(' ') || l.email || l.phone || 'Unnamed lead';

export function LeadsPage() {
  const navigate = useNavigate();
  const allLeads = useLeads();
  const lists = useLeadLists();
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const members = useListMembers(activeListId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<LeadView | 'new' | null>(null);
  const [emailFor, setEmailFor] = useState<string | null>(null);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const deleteList = useDeleteList();
  const addToList = useAddToList();
  const removeFromList = useRemoveFromList();
  const deleteLead = useDeleteLead();

  const rows = activeListId ? (members.data ?? []) : (allLeads.data ?? []);
  const loading = activeListId ? members.isLoading : allLeads.isLoading;
  const selectedIds = useMemo(() => [...selected], [selected]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((s) => (s.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  async function handleAddToList(listId: string) {
    if (selectedIds.length === 0) return;
    const res = await addToList.mutateAsync({ listId, leadIds: selectedIds });
    setNotice(`Added to list — now ${res.memberCount} members.`);
    setSelected(new Set());
  }

  async function handleRemoveFromList() {
    if (!activeListId || selectedIds.length === 0) return;
    await removeFromList.mutateAsync({ listId: activeListId, leadIds: selectedIds });
    setSelected(new Set());
  }

  return (
    <div className="mx-auto w-full max-w-8xl space-y-6 py-2">
      <button
        type="button"
        onClick={() => setEditing('new')}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-surface-inverse px-4 text-sm font-semibold text-ink-inverse transition hover:bg-ink"
      >
        <Plus className="size-4" /> New lead
      </button>

      {notice ? (
        <div className="rounded-md bg-surface px-4 py-3 text-sm text-ink-muted ring-1 ring-border-subtle">{notice}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Lists rail */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Lists</h2>
            <button type="button" onClick={() => setListModalOpen(true)} className="text-ink-muted hover:text-ink" aria-label="New list">
              <ListPlus className="size-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveListId(null);
              setSelected(new Set());
            }}
            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition ${
              activeListId === null ? 'bg-surface-inverse text-ink-inverse' : 'text-ink-muted hover:bg-surface-sunken'
            }`}
          >
            <span>All leads</span>
            <span className="text-xs">{allLeads.data?.length ?? 0}</span>
          </button>
          {(lists.data ?? []).map((list) => (
            <div
              key={list.id}
              className={`rounded-md px-3 py-2 ring-1 transition ${
                activeListId === list.id ? 'bg-surface ring-border-strong' : 'ring-border-subtle hover:ring-border'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveListId(list.id);
                  setSelected(new Set());
                }}
                className="flex w-full items-center justify-between text-left text-sm text-ink"
              >
                <span className="truncate font-medium">{list.name}</span>
                <span className="text-xs text-ink-faint">{list.memberCount}</span>
              </button>
              {activeListId === list.id ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => navigate(`/ai-assistant?list=${list.id}`)}
                    className="inline-flex items-center gap-1 rounded bg-surface-sunken px-2 py-1 text-xs text-ink ring-1 ring-border-subtle hover:ring-border-strong"
                  >
                    <Sparkles className="size-3" /> AI call
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailFor(list.id)}
                    className="inline-flex items-center gap-1 rounded bg-surface-sunken px-2 py-1 text-xs text-ink ring-1 ring-border-subtle hover:ring-border-strong"
                  >
                    <Mail className="size-3" /> Email
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm(`Delete list “${list.name}”? Leads are not deleted.`)) {
                        await deleteList.mutateAsync(list.id);
                        setActiveListId(null);
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded bg-surface-sunken px-2 py-1 text-xs text-accent-red ring-1 ring-border-subtle hover:ring-accent-red/40"
                  >
                    <Trash2 className="size-3" /> Delete
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* Leads table */}
        <div className="space-y-3">
          {selectedIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface px-3 py-2 text-sm ring-1 ring-border-subtle">
              <span className="text-ink-muted">{selectedIds.length} selected</span>
              <span className="text-ink-faint">·</span>
              <span className="text-ink-faint">Add to list:</span>
              {(lists.data ?? []).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => handleAddToList(l.id)}
                  className="rounded bg-surface-sunken px-2 py-1 text-xs text-ink ring-1 ring-border-subtle hover:ring-border-strong"
                >
                  {l.name}
                </button>
              ))}
              {activeListId ? (
                <button
                  type="button"
                  onClick={handleRemoveFromList}
                  className="ml-auto rounded bg-surface-sunken px-2 py-1 text-xs text-accent-red ring-1 ring-border-subtle hover:ring-accent-red/40"
                >
                  Remove from this list
                </button>
              ) : null}
            </div>
          ) : null}

          {loading ? (
            <div className="grid min-h-[30vh] place-items-center text-ink-muted">Loading leads…</div>
          ) : rows.length === 0 ? (
            <Card className="py-12 text-center text-ink-muted">
              {activeListId ? 'This list is empty. Select leads and add them.' : 'No leads yet. Create your first lead.'}
            </Card>
          ) : (
            <Card padding={false} className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-left text-xs text-ink-faint">
                    <th className="w-10 p-3">
                      <input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} />
                    </th>
                    <th className="p-3">Name</th>
                    <th className="hidden p-3 md:table-cell">Company</th>
                    <th className="hidden p-3 lg:table-cell">Contact</th>
                    <th className="p-3">Status</th>
                    <th className="w-20 p-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((lead) => (
                    <tr key={lead.id} className="border-b border-border-subtle/60 last:border-0 hover:bg-surface-sunken/40">
                      <td className="p-3">
                        <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggle(lead.id)} />
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/leads/${lead.id}`)}
                          className="text-left font-medium text-ink hover:underline"
                        >
                          {fullName(lead)}
                        </button>
                        {lead.jobTitle ? <div className="text-xs text-ink-faint">{lead.jobTitle}</div> : null}
                      </td>
                      <td className="hidden p-3 text-ink-muted md:table-cell">{lead.company ?? '—'}</td>
                      <td className="hidden p-3 lg:table-cell">
                        <div className="text-ink-muted">{lead.email ?? '—'}</div>
                        <div className="text-xs text-ink-faint">{lead.phone ?? ''}</div>
                      </td>
                      <td className="p-3">
                        <Badge variant={STATUS_TONE[lead.status]}>{lead.status}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setEditing(lead)} aria-label="Edit" className="grid size-8 place-items-center rounded text-ink-muted hover:text-ink">
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm(`Delete ${fullName(lead)}?`)) await deleteLead.mutateAsync(lead.id);
                            }}
                            aria-label="Delete"
                            className="grid size-8 place-items-center rounded text-ink-faint hover:text-accent-red"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </div>

      {editing ? (
        <LeadFormModal
          lead={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setNotice(msg);
            setEditing(null);
          }}
        />
      ) : null}

      {emailFor ? <EmailModal listId={emailFor} onClose={() => setEmailFor(null)} onSent={setNotice} /> : null}

      {listModalOpen ? (
        <ListFormModal
          onClose={() => setListModalOpen(false)}
          onCreated={(msg) => {
            setNotice(msg);
            setListModalOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

// --- Create list ---

function ListFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: (msg: string) => void }) {
  const create = useCreateList();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Give the list a name.');
      return;
    }
    try {
      const list = await create.mutateAsync({ name: name.trim(), description: description.trim() || null });
      onCreated(`List “${list.name}” created.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the list.');
    }
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ModalHeader title="New list" onClose={onClose} />
        <Field label="List name" full>
          <Input value={name} onChange={setName} placeholder="e.g. Q3 enterprise prospects" />
        </Field>
        <Field label="Description (optional)" full>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What this segment is for…"
            className="w-full rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink ring-1 ring-border-subtle outline-none transition focus:ring-border-strong"
          />
        </Field>
        {error ? <p className="text-sm text-accent-red">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="h-10 rounded-md bg-surface-sunken px-5 text-sm font-medium text-ink ring-1 ring-border-subtle hover:ring-border-strong">
            Cancel
          </button>
          <button type="submit" disabled={create.isPending} className="h-10 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse hover:bg-ink disabled:opacity-60">
            {create.isPending ? 'Creating…' : 'Create list'}
          </button>
        </div>
      </form>
    </Overlay>
  );
}

// --- Lead create/edit form ---

function LeadFormModal({ lead, onClose, onSaved }: { lead: LeadView | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const create = useCreateLead();
  const update = useUpdateLead();
  const [form, setForm] = useState({
    firstName: lead?.firstName ?? '',
    lastName: lead?.lastName ?? '',
    email: lead?.email ?? '',
    phone: lead?.phone ?? '',
    company: lead?.company ?? '',
    jobTitle: lead?.jobTitle ?? '',
    status: lead?.status ?? ('new' as LeadStatus),
    source: lead?.source ?? '',
    value: lead?.value != null ? String(lead.value) : '',
    website: lead?.website ?? '',
    linkedinUrl: lead?.linkedinUrl ?? '',
    city: lead?.city ?? '',
    country: lead?.country ?? '',
    timezone: lead?.timezone ?? '',
    notes: lead?.notes ?? '',
    tags: (lead?.tags ?? []).join(', '),
  });
  const [error, setError] = useState('');
  const pending = create.isPending || update.isPending;
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const n = (s: string) => (s.trim() === '' ? null : s.trim());
    const payload: CreateLeadInput = {
      firstName: n(form.firstName),
      lastName: n(form.lastName),
      email: n(form.email),
      phone: n(form.phone),
      company: n(form.company),
      jobTitle: n(form.jobTitle),
      status: form.status,
      source: n(form.source),
      value: form.value.trim() ? Math.max(0, Math.round(Number(form.value))) : null,
      website: n(form.website),
      linkedinUrl: n(form.linkedinUrl),
      city: n(form.city),
      country: n(form.country),
      timezone: n(form.timezone),
      notes: n(form.notes),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    };
    try {
      if (lead) {
        await update.mutateAsync({ id: lead.id, input: payload });
        onSaved('Lead updated.');
      } else {
        await create.mutateAsync(payload);
        onSaved('Lead created.');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the lead.');
    }
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ModalHeader title={lead ? 'Edit lead' : 'New lead'} onClose={onClose} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name"><Input value={form.firstName} onChange={(v) => set('firstName', v)} /></Field>
          <Field label="Last name"><Input value={form.lastName} onChange={(v) => set('lastName', v)} /></Field>
          <Field label="Email"><Input value={form.email} onChange={(v) => set('email', v)} placeholder="name@company.com" /></Field>
          <Field label="Phone (E.164 for AI calls)"><Input value={form.phone} onChange={(v) => set('phone', v)} placeholder="+14155551234" /></Field>
          <Field label="Company"><Input value={form.company} onChange={(v) => set('company', v)} /></Field>
          <Field label="Job title"><Input value={form.jobTitle} onChange={(v) => set('jobTitle', v)} /></Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => set('status', e.target.value as LeadStatus)} className="h-10 w-full rounded-md bg-surface-sunken px-3 text-sm text-ink ring-1 ring-border-subtle outline-none focus:ring-border-strong">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Source"><Input value={form.source} onChange={(v) => set('source', v)} placeholder="linkedin, referral…" /></Field>
          <Field label="Deal value"><Input value={form.value} onChange={(v) => set('value', v)} placeholder="0" /></Field>
          <Field label="Website"><Input value={form.website} onChange={(v) => set('website', v)} /></Field>
          <Field label="LinkedIn URL"><Input value={form.linkedinUrl} onChange={(v) => set('linkedinUrl', v)} /></Field>
          <Field label="City"><Input value={form.city} onChange={(v) => set('city', v)} /></Field>
          <Field label="Country"><Input value={form.country} onChange={(v) => set('country', v)} /></Field>
          <Field label="Timezone"><Input value={form.timezone} onChange={(v) => set('timezone', v)} placeholder="Asia/Kolkata" /></Field>
          <Field label="Tags (comma separated)" full><Input value={form.tags} onChange={(v) => set('tags', v)} placeholder="enterprise, warm" /></Field>
          <Field label="Notes" full>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className="w-full rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink ring-1 ring-border-subtle outline-none focus:ring-border-strong" />
          </Field>
        </div>
        {error ? <p className="text-sm text-accent-red">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="h-10 rounded-md bg-surface-sunken px-5 text-sm font-medium text-ink ring-1 ring-border-subtle hover:ring-border-strong">Cancel</button>
          <button type="submit" disabled={pending} className="h-10 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse hover:bg-ink disabled:opacity-60">
            {pending ? 'Saving…' : lead ? 'Save changes' : 'Create lead'}
          </button>
        </div>
      </form>
    </Overlay>
  );
}

function EmailModal({ listId, onClose, onSent }: { listId: string; onClose: () => void; onSent: (msg: string) => void }) {
  const send = useSendListEmail();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await send.mutateAsync({ listId, input: { subject: subject.trim(), body: body.trim() } });
      onSent(`Email outreach logged for ${res.recipients} recipient(s).`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send.');
    }
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ModalHeader title="Email this list" onClose={onClose} />
        <p className="text-xs text-ink-faint">
          Logs outreach against every lead in the list with an email address. Actual delivery requires an email provider
          to be configured.
        </p>
        <Field label="Subject" full><Input value={subject} onChange={setSubject} /></Field>
        <Field label="Message" full>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="w-full rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink ring-1 ring-border-subtle outline-none focus:ring-border-strong" />
        </Field>
        {error ? <p className="text-sm text-accent-red">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-md bg-surface-sunken px-5 text-sm font-medium text-ink ring-1 ring-border-subtle hover:ring-border-strong">Cancel</button>
          <button type="submit" disabled={send.isPending} className="inline-flex h-10 items-center gap-2 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse hover:bg-ink disabled:opacity-60">
            <Mail className="size-4" /> {send.isPending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </Overlay>
  );
}

// --- shared bits ---

function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-surface p-6 ring-1 ring-border" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-display-sm tracking-normal">{title}</h2>
      <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink">
        <X className="size-4" />
      </button>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-md bg-surface-sunken px-3 text-sm text-ink ring-1 ring-border-subtle outline-none transition focus:ring-border-strong"
    />
  );
}
