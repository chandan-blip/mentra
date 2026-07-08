import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { AdminModule, AdminRole, ModulePlacement } from '@mentra/shared';
import { useAdminModules, useAdminRoles, useDeleteModule, useSaveModule } from '../../lib/admin.js';
import { MODULE_ICON_NAMES, moduleIcon } from '../../lib/moduleIcons.js';
import { AdminPageShell } from './AdminPageShell.js';
import { Switch } from '../../components/Switch.js';

const PLACEMENTS: { value: ModulePlacement; label: string; hint: string }[] = [
  { value: 'sidebar', label: 'Sidebar', hint: 'Shows in the navigation rail' },
  { value: 'other', label: 'Other', hint: 'Access control only — hidden from the sidebar' },
];

const blankModule = (sortOrder: number): AdminModule => ({
  key: '',
  label: '',
  description: null,
  icon: null,
  route: null,
  parentKey: null,
  placement: 'sidebar',
  role: null,
  sortOrder,
  active: true,
});

export function AdminModulesPage() {
  const { data: modules } = useAdminModules();
  const { data: roles } = useAdminRoles();
  const save = useSaveModule();
  const del = useDeleteModule();

  const [editing, setEditing] = useState<{ module: AdminModule; isNew: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextSort = Math.max(0, ...(modules ?? []).map((m) => m.sortOrder)) + 1;
  const roleLabel = (id: string | null) => (id ? (roles ?? []).find((r) => r.id === id)?.label ?? id : null);

  function onDelete(m: AdminModule) {
    setError(null);
    if (!window.confirm(`Delete module “${m.label}” (${m.key})? This removes it from all roles and plans.`)) {
      return;
    }
    del.mutate(m.key, { onError: (e) => setError((e as Error).message) });
  }

  return (
    <AdminPageShell title="Modules" subtitle="Add, edit, enable, or remove platform modules across the app.">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-ink-faint">
          Placement “Sidebar” shows a module in the nav rail; “Other” keeps it for access control only.
          Role is an informational tag for the intended audience — it doesn’t affect access (set that under Roles &
          permissions). Sub-modules nest under a parent.
        </p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setEditing({ module: blankModule(nextSort), isNew: true });
          }}
          className="flex h-9 items-center gap-1.5 rounded-md bg-surface-inverse px-3 text-sm font-semibold text-ink-inverse transition hover:bg-ink"
        >
          <Plus className="size-4" /> Add module
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-md bg-accent-red/10 px-3 py-2 text-sm text-accent-red ring-1 ring-accent-red/20">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md ring-1 ring-border-subtle">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-ink-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Module</th>
              <th className="px-4 py-2 text-left font-medium">Route</th>
              <th className="px-4 py-2 text-center font-medium">Placement</th>
              <th className="px-4 py-2 text-center font-medium">Role</th>
              <th className="px-4 py-2 text-center font-medium">Sort</th>
              <th className="px-4 py-2 text-center font-medium">Active</th>
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(modules ?? []).map((m) => (
              <tr key={m.key} className="border-t border-border-subtle">
                <td className="px-4 py-2">
                  <span className={m.parentKey ? 'pl-4 text-ink-muted' : 'text-ink'}>{m.label}</span>
                  <span className="ml-2 text-xs text-ink-faint">{m.key}</span>
                </td>
                <td className="px-4 py-2 text-ink-muted">
                  {m.route ?? <span className="text-ink-faint">— coming soon</span>}
                </td>
                <td className="px-4 py-2 text-center">
                  <span
                    className={
                      m.placement === 'sidebar'
                        ? 'rounded-sm bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted ring-1 ring-border-subtle'
                        : 'rounded-sm bg-surface-sunken px-2 py-0.5 text-xs text-ink-faint ring-1 ring-border-subtle'
                    }
                  >
                    {m.placement === 'sidebar' ? 'Sidebar' : 'Other'}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  {roleLabel(m.role) ? (
                    <span className="rounded-sm bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted ring-1 ring-border-subtle">
                      {roleLabel(m.role)}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-faint">All</span>
                  )}
                </td>
                <td className="px-4 py-2 text-center text-ink-muted">{m.sortOrder}</td>
                <td className="px-4 py-2 text-center">
                  <Switch
                    checked={m.active}
                    onChange={(next) => save.mutate({ ...m, active: next })}
                    aria-label={`Toggle ${m.label} active`}
                  />
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setEditing({ module: m, isNew: false });
                      }}
                      className="rounded-md p-1.5 text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
                      aria-label={`Edit ${m.label}`}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(m)}
                      disabled={del.isPending}
                      className="rounded-md p-1.5 text-ink-muted transition hover:bg-accent-red/10 hover:text-accent-red disabled:opacity-50"
                      aria-label={`Delete ${m.label}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <ModuleForm
          initial={editing.module}
          isNew={editing.isNew}
          parents={(modules ?? []).filter((m) => !m.parentKey && m.key !== editing.module.key)}
          roles={roles ?? []}
          pending={save.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(mod) => {
            setError(null);
            save.mutate(mod, {
              onSuccess: () => setEditing(null),
              onError: (e) => setError((e as Error).message),
            });
          }}
        />
      ) : null}
    </AdminPageShell>
  );
}

function ModuleForm({
  initial,
  isNew,
  parents,
  roles,
  pending,
  onClose,
  onSubmit,
}: {
  initial: AdminModule;
  isNew: boolean;
  parents: AdminModule[];
  roles: AdminRole[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (m: AdminModule) => void;
}) {
  const [form, setForm] = useState(initial);
  const set = <K extends keyof AdminModule>(k: K, v: AdminModule[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const nullable = (v: string): string | null => (v.trim() === '' ? null : v.trim());

  const keyValid = /^[a-z0-9][a-z0-9._-]*$/i.test(form.key.trim());
  const canSubmit = keyValid && form.label.trim().length > 0 && !pending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas-deep/72 px-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-surface p-5 shadow-card ring-1 ring-border"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-ink">{isNew ? 'Add module' : `Edit ${initial.label}`}</h2>

        <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <Field label="Key">
            <input
              value={form.key}
              disabled={!isNew}
              onChange={(e) => set('key', e.target.value)}
              placeholder="e.g. learning or assessment.history"
              className="auth-input-plain h-9 w-full disabled:opacity-60"
            />
            {isNew && form.key.length > 0 && !keyValid ? (
              <span className="text-xs text-accent-red">Letters, numbers, dot, dash, underscore.</span>
            ) : null}
          </Field>

          <Field label="Label">
            <input
              value={form.label}
              onChange={(e) => set('label', e.target.value)}
              placeholder="Display name"
              className="auth-input-plain h-9 w-full"
            />
          </Field>

          <Field label="Description" className="sm:col-span-2">
            <textarea
              value={form.description ?? ''}
              onChange={(e) => set('description', nullable(e.target.value))}
              placeholder="Detailed description — shown to users on the locked-module screen"
              rows={4}
              className="auth-input-plain min-h-[6rem] w-full resize-y py-2 leading-6"
            />
          </Field>

          <Field label="Icon" className="sm:col-span-2">
            <IconPicker value={form.icon} onChange={(name) => set('icon', name)} />
          </Field>

          <Field label="Sort order">
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => set('sortOrder', Number(e.target.value) || 0)}
              className="auth-input-plain h-9 w-full"
            />
          </Field>

          <Field label="Route">
            <input
              value={form.route ?? ''}
              onChange={(e) => set('route', nullable(e.target.value))}
              placeholder="/path — leave empty for “coming soon”"
              className="auth-input-plain h-9 w-full"
            />
          </Field>

          <Field label="Placement">
            <select
              value={form.placement}
              onChange={(e) => set('placement', e.target.value as ModulePlacement)}
              className="auth-input-plain h-9 w-full"
            >
              {PLACEMENTS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-ink-faint">
              {PLACEMENTS.find((p) => p.value === form.placement)?.hint}
            </span>
          </Field>

          <Field label="Role (audience)">
            <select
              value={form.role ?? ''}
              onChange={(e) => set('role', e.target.value === '' ? null : e.target.value)}
              className="auth-input-plain h-9 w-full"
            >
              <option value="">All roles (no specific audience)</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({r.id})
                </option>
              ))}
            </select>
            <span className="text-xs text-ink-faint">Informational only — doesn’t change who can access the module.</span>
          </Field>

          <Field label="Parent module">
            <select
              value={form.parentKey ?? ''}
              onChange={(e) => set('parentKey', e.target.value === '' ? null : e.target.value)}
              className="auth-input-plain h-9 w-full"
            >
              <option value="">None (top-level)</option>
              {parents.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label} ({p.key})
                </option>
              ))}
            </select>
          </Field>

          <div className="sm:col-span-2">
            <Switch
              checked={form.active}
              onChange={(next) => set('active', next)}
              label="Active (visible across the app)"
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-md bg-surface-sunken px-4 text-sm font-medium text-ink ring-1 ring-border-subtle transition hover:bg-surface-raised"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit({ ...form, key: form.key.trim(), label: form.label.trim() })}
            className="h-11 rounded-md bg-surface-inverse px-4 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
          >
            {pending ? 'Saving…' : isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Visual picker over every icon the sidebar can render (single source of truth). */
function IconPicker({ value, onChange }: { value: string | null; onChange: (name: string | null) => void }) {
  const [q, setQ] = useState('');
  const names = q.trim() ? MODULE_ICON_NAMES.filter((n) => n.toLowerCase().includes(q.trim().toLowerCase())) : MODULE_ICON_NAMES;
  return (
    <div className="rounded-md ring-1 ring-border-subtle">
      <div className="flex items-center gap-2 border-b border-border-subtle px-2 py-1.5">
        <span className="text-xs text-ink-muted">
          {value ? `Selected: ${value}` : 'No icon'}
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="ml-auto h-7 w-28 rounded bg-surface-sunken px-2 text-xs text-ink outline-none ring-1 ring-border-subtle placeholder:text-ink-faint"
        />
        {value ? (
          <button type="button" onClick={() => onChange(null)} className="text-xs font-medium text-ink-faint transition hover:text-accent-red">
            Clear
          </button>
        ) : null}
      </div>
      <div className="grid max-h-40 grid-cols-7 gap-1 overflow-auto p-2 sm:grid-cols-8">
        {names.map((name) => (
          <button
            key={name}
            type="button"
            title={name}
            onClick={() => onChange(name)}
            className={`grid aspect-square place-items-center rounded-md transition [&_svg]:size-4 ${
              value === name ? 'bg-surface-inverse text-ink-inverse' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
            }`}
          >
            {moduleIcon(name)}
          </button>
        ))}
        {names.length === 0 ? <span className="col-span-full px-1 py-2 text-xs text-ink-faint">No icons match.</span> : null}
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
