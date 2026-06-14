import { useState, type FormEvent, type ReactNode } from 'react';
import { Building2, Pencil, Plus, Trash2, Wand2, X } from 'lucide-react';
import { Badge, Card } from '@mentra/ui';
import type {
  CreateJobInput,
  JobEmploymentType,
  JobExperience,
  JobLocationType,
  JobStatus,
  JobView,
} from '@mentra/shared';
import { PageHeader } from '../../components/PageHeader.js';
import {
  EMPLOYMENT_LABEL,
  EXPERIENCE_LABEL,
  LOCATION_TYPE_LABEL,
  useCreateJob,
  useDeleteJob,
  useHrDiscoverJobs,
  useHrJobs,
  useUpdateJob,
} from '../../lib/jobs.js';

/**
 * HR Job Postings — create, edit and close openings, or let the AI discover a batch
 * for a role/skill set. Everything here writes to the same `Job` table that powers
 * the student board.
 */
export function HrJobsPage() {
  const jobs = useHrJobs();
  const discover = useHrDiscoverJobs();
  const deleteJob = useDeleteJob();
  const [editing, setEditing] = useState<JobView | 'new' | null>(null);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const list = jobs.data ?? [];

  async function handleDelete(job: JobView) {
    if (!window.confirm(`Delete “${job.title}” at ${job.company}? This cannot be undone.`)) return;
    await deleteJob.mutateAsync(job.id);
  }

  return (
    <div className="mx-auto w-full max-w-8xl space-y-6 py-2">
      <PageHeader
        icon={<Building2 />}
        title="Job Postings"
        subtitle="Post openings for students and manage the live board."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDiscoverOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-surface-sunken px-4 text-sm font-medium text-ink ring-1 ring-border-subtle transition hover:ring-border-strong"
            >
              <Wand2 className="size-4" />
              Discover with AI
            </button>
            <button
              type="button"
              onClick={() => setEditing('new')}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-surface-inverse px-4 text-sm font-semibold text-ink-inverse transition hover:bg-ink"
            >
              <Plus className="size-4" />
              New posting
            </button>
          </div>
        }
      />

      {notice ? (
        <div className="rounded-md bg-surface px-4 py-3 text-sm text-ink-muted ring-1 ring-border-subtle">{notice}</div>
      ) : null}

      {jobs.isLoading ? (
        <div className="grid min-h-[40vh] place-items-center text-ink-muted">Loading postings…</div>
      ) : list.length === 0 ? (
        <Card className="py-14 text-center text-ink-muted">
          No postings yet. Create one or let the AI discover a batch.
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((job) => (
            <Card key={job.id} interactive={false} className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-base font-semibold text-ink">{job.title}</h3>
                  <Badge variant={job.status === 'open' ? 'success' : 'outline'}>{job.status}</Badge>
                  <Badge variant={job.source === 'hr' ? 'info' : 'default'}>
                    {job.source === 'hr' ? 'HR' : 'AI'}
                  </Badge>
                </div>
                <div className="mt-1 truncate text-sm text-ink-muted">
                  {job.company} · {job.location || LOCATION_TYPE_LABEL[job.locationType]} ·{' '}
                  {EMPLOYMENT_LABEL[job.employmentType]} · {EXPERIENCE_LABEL[job.experienceLevel]}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(job)}
                  aria-label="Edit posting"
                  className="grid size-9 place-items-center rounded-md text-ink-muted ring-1 ring-border-subtle transition hover:text-ink hover:ring-border-strong"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(job)}
                  aria-label="Delete posting"
                  className="grid size-9 place-items-center rounded-md text-accent-red ring-1 ring-border-subtle transition hover:ring-accent-red/40"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing ? (
        <JobFormModal
          job={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setNotice(msg);
            setEditing(null);
          }}
        />
      ) : null}

      {discoverOpen ? (
        <DiscoverModal
          pending={discover.isPending}
          onClose={() => setDiscoverOpen(false)}
          onRun={async (role, skills, count) => {
            try {
              const res = await discover.mutateAsync({ role: role || undefined, skills, count });
              setNotice(`AI added ${res.created} new ${res.created === 1 ? 'posting' : 'postings'}.`);
              setDiscoverOpen(false);
            } catch (err) {
              setNotice(err instanceof Error ? err.message : 'AI discovery failed.');
            }
          }}
        />
      ) : null}
    </div>
  );
}

// --- Create / edit form ---

const LOCATION_TYPES: JobLocationType[] = ['onsite', 'remote', 'hybrid'];
const EMPLOYMENT_TYPES: JobEmploymentType[] = ['full-time', 'part-time', 'internship', 'contract'];
const EXPERIENCE_LEVELS: JobExperience[] = ['entry', 'mid', 'senior'];

function JobFormModal({
  job,
  onClose,
  onSaved,
}: {
  job: JobView | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const create = useCreateJob();
  const update = useUpdateJob();
  const [form, setForm] = useState({
    title: job?.title ?? '',
    company: job?.company ?? '',
    location: job?.location ?? '',
    locationType: job?.locationType ?? ('onsite' as JobLocationType),
    employmentType: job?.employmentType ?? ('full-time' as JobEmploymentType),
    experienceLevel: job?.experienceLevel ?? ('entry' as JobExperience),
    description: job?.description ?? '',
    skills: (job?.skills ?? []).join(', '),
    salary: job?.salary ?? '',
    applyUrl: job?.applyUrl ?? '',
    status: job?.status ?? ('open' as JobStatus),
  });
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim() || !form.company.trim() || !form.description.trim()) {
      setError('Title, company and description are required.');
      return;
    }
    const payload: CreateJobInput = {
      title: form.title.trim(),
      company: form.company.trim(),
      location: form.location.trim() || null,
      locationType: form.locationType,
      employmentType: form.employmentType,
      experienceLevel: form.experienceLevel,
      description: form.description.trim(),
      skills: form.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      salary: form.salary.trim() || null,
      applyUrl: form.applyUrl.trim() || null,
    };
    try {
      if (job) {
        await update.mutateAsync({ id: job.id, input: { ...payload, status: form.status } });
        onSaved('Posting updated.');
      } else {
        await create.mutateAsync(payload);
        onSaved('Posting created.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the posting.');
    }
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ModalHeader title={job ? 'Edit posting' : 'New posting'} onClose={onClose} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Job title" full>
            <Input value={form.title} onChange={(v) => set('title', v)} placeholder="Frontend Engineer" />
          </Field>
          <Field label="Company">
            <Input value={form.company} onChange={(v) => set('company', v)} placeholder="Acme Inc." />
          </Field>
          <Field label="Location">
            <Input value={form.location} onChange={(v) => set('location', v)} placeholder="Bengaluru, India" />
          </Field>
          <Field label="Work type">
            <Select value={form.locationType} onChange={(v) => set('locationType', v as JobLocationType)} options={LOCATION_TYPES} labels={LOCATION_TYPE_LABEL} />
          </Field>
          <Field label="Employment">
            <Select value={form.employmentType} onChange={(v) => set('employmentType', v as JobEmploymentType)} options={EMPLOYMENT_TYPES} labels={EMPLOYMENT_LABEL} />
          </Field>
          <Field label="Experience">
            <Select value={form.experienceLevel} onChange={(v) => set('experienceLevel', v as JobExperience)} options={EXPERIENCE_LEVELS} labels={EXPERIENCE_LABEL} />
          </Field>
          <Field label="Salary (optional)">
            <Input value={form.salary} onChange={(v) => set('salary', v)} placeholder="₹12–18 LPA" />
          </Field>
          <Field label="Apply URL (optional)" full>
            <Input value={form.applyUrl} onChange={(v) => set('applyUrl', v)} placeholder="https://company.com/careers/123" />
          </Field>
          <Field label="Required skills (comma separated)" full>
            <Input value={form.skills} onChange={(v) => set('skills', v)} placeholder="React, TypeScript, Node.js" />
          </Field>
          <Field label="Description" full>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={4}
              placeholder="What the role involves, the team, and what you're looking for…"
              className="w-full rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink ring-1 ring-border-subtle outline-none transition focus:ring-border-strong"
            />
          </Field>
          {job ? (
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(v) => set('status', v as JobStatus)}
                options={['open', 'closed'] as JobStatus[]}
                labels={{ open: 'Open', closed: 'Closed' }}
              />
            </Field>
          ) : null}
        </div>

        {error ? <p className="text-sm text-accent-red">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-md bg-surface-sunken px-5 text-sm font-medium text-ink ring-1 ring-border-subtle transition hover:ring-border-strong"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-60"
          >
            {pending ? 'Saving…' : job ? 'Save changes' : 'Create posting'}
          </button>
        </div>
      </form>
    </Overlay>
  );
}

function DiscoverModal({
  pending,
  onClose,
  onRun,
}: {
  pending: boolean;
  onClose: () => void;
  onRun: (role: string, skills: string[], count: number) => void;
}) {
  const [role, setRole] = useState('');
  const [skills, setSkills] = useState('');
  const [count, setCount] = useState(8);

  return (
    <Overlay onClose={onClose}>
      <div className="space-y-4">
        <ModalHeader title="Discover jobs with AI" onClose={onClose} />
        <p className="text-sm leading-6 text-ink-muted">
          The AI searches the current job market and adds matching openings to the board. Leave fields blank for a
          general tech batch.
        </p>
        <Field label="Target role (optional)" full>
          <Input value={role} onChange={setRole} placeholder="Backend Engineer" />
        </Field>
        <Field label="Skills (comma separated, optional)" full>
          <Input value={skills} onChange={setSkills} placeholder="Go, Postgres, Kubernetes" />
        </Field>
        <Field label="How many" full>
          <Input value={String(count)} onChange={(v) => setCount(Math.max(1, Math.min(20, Number(v) || 8)))} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-md bg-surface-sunken px-5 text-sm font-medium text-ink ring-1 ring-border-subtle transition hover:ring-border-strong"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              onRun(
                role.trim(),
                skills
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
                count,
              )
            }
            className="inline-flex h-10 items-center gap-2 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-60"
          >
            <Wand2 className="size-4" />
            {pending ? 'Searching…' : 'Run discovery'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// --- Small UI helpers ---

function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-surface p-6 ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-display-sm tracking-normal">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="grid size-9 place-items-center rounded-md text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
      >
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

function Select<T extends string>({
  value,
  onChange,
  options,
  labels,
}: {
  value: T;
  onChange: (v: string) => void;
  options: T[];
  labels: Record<T, string>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-md bg-surface-sunken px-3 text-sm text-ink ring-1 ring-border-subtle outline-none transition focus:ring-border-strong"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {labels[opt]}
        </option>
      ))}
    </select>
  );
}
