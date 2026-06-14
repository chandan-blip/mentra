import { useMemo, useState } from 'react';
import type { AdminModule, AdminRole } from '@mentra/shared';
import { useAdminModules, useAdminPlans, useAdminRoles, useSavePlan } from '../../lib/admin.js';
import { AdminPageShell } from './AdminPageShell.js';

/** Admin-only management modules — never offered as part of a subscription plan. */
function isAdminModule(m: AdminModule): boolean {
  return m.role === 'admin' || m.key.startsWith('admin.') || (m.route?.startsWith('/admin') ?? false);
}

export function AdminSubscriptionsPage() {
  const { data: plans } = useAdminPlans();
  const { data: modules } = useAdminModules();
  const { data: roles } = useAdminRoles();
  const save = useSavePlan();
  const [editing, setEditing] = useState<string | null>(null);

  // Plans can include any module except the admin-only management ones.
  const sellableModules = useMemo(() => (modules ?? []).filter((m) => !isAdminModule(m)), [modules]);
  // Subscriptions target non-admin roles (admins bypass plan gating entirely).
  const targetRoles = useMemo(() => (roles ?? []).filter((r) => !r.isAdmin), [roles]);

  const blank = {
    id: '',
    name: '',
    description: null as string | null,
    priceCents: 0,
    active: true,
    roleId: null as string | null,
    moduleKeys: [] as string[],
  };
  const current = editing === '__new__' ? blank : plans?.find((p) => p.id === editing);

  return (
    <AdminPageShell title="Subscriptions" subtitle="Create plans and choose which modules each one includes.">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {(plans ?? []).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setEditing(p.id)}
              className={['flex w-full items-center justify-between rounded-md px-4 py-3 text-left ring-1 transition', editing === p.id ? 'bg-surface-sunken ring-border-strong' : 'bg-surface ring-border-subtle hover:ring-border-strong'].join(' ')}
            >
              <span>
                <span className="text-sm font-medium text-ink">{p.name}</span>
                {p.isDefault ? <span className="ml-2 text-xs text-accent-green">default</span> : null}
                <span className="block text-xs text-ink-faint">
                  {p.moduleKeys.length} modules · ₹{(p.priceCents / 100).toFixed(0)} ·{' '}
                  {p.roleId ? (roles?.find((r) => r.id === p.roleId)?.label ?? p.roleId) : 'All roles'}
                </span>
              </span>
            </button>
          ))}
          <button type="button" onClick={() => setEditing('__new__')} className="w-full rounded-md border border-dashed border-border px-4 py-3 text-sm text-ink-muted hover:text-ink">
            + New subscription
          </button>
        </div>

        {current ? (
          <PlanEditor
            key={editing}
            plan={current}
            modules={sellableModules}
            roles={targetRoles}
            onSave={(p) => {
              save.mutate(p);
              setEditing(p.id);
            }}
          />
        ) : (
          <div className="rounded-md bg-surface-sunken p-5 text-sm text-ink-muted ring-1 ring-border-subtle">
            Select a plan to edit, or create a new subscription and choose which modules it includes.
          </div>
        )}
      </div>
    </AdminPageShell>
  );
}

type PlanForm = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  active: boolean;
  roleId: string | null;
  moduleKeys: string[];
};

function PlanEditor({
  plan,
  modules,
  roles,
  onSave,
}: {
  plan: PlanForm;
  modules: AdminModule[];
  roles: AdminRole[];
  onSave: (p: PlanForm) => void;
}) {
  const isNew = plan.id === '';
  const [id, setId] = useState(plan.id);
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(String(Math.round(plan.priceCents / 100)));
  const [active, setActive] = useState(plan.active);
  const [roleId, setRoleId] = useState<string | null>(plan.roleId);
  const [picked, setPicked] = useState<string[]>(plan.moduleKeys);

  const toggle = (k: string) => setPicked((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  return (
    <div className="rounded-md bg-surface p-5 ring-1 ring-border">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-ink-muted">Plan id</span>
          <input disabled={!isNew} value={id} onChange={(e) => setId(e.target.value.toLowerCase().replace(/\s+/g, '-'))} className="auth-input-plain h-10 disabled:opacity-60" placeholder="e.g. premium" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-muted">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="auth-input-plain h-10" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-muted">Price (₹)</span>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="auth-input-plain h-10" />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm text-ink">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
        <label className="col-span-2 block">
          <span className="mb-1 block text-xs text-ink-muted">Available to role</span>
          <select
            value={roleId ?? ''}
            onChange={(e) => setRoleId(e.target.value || null)}
            className="auth-input-plain h-10"
          >
            <option value="">All roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-ink-faint">
            Only accounts with this role will see this subscription. Choose “All roles” to show it to everyone.
          </span>
        </label>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-xs text-ink-muted">Included modules &amp; features (excludes admin modules)</div>
        {modules.length === 0 ? (
          <div className="rounded-md bg-surface-sunken p-3 text-xs text-ink-faint ring-1 ring-border-subtle">
            No modules available. Create modules in the Modules admin first.
          </div>
        ) : (
          <div className="grid max-h-56 grid-cols-2 gap-1 overflow-auto">
            {modules.map((m) => (
              <label key={m.key} className="flex items-center gap-2 rounded px-2 py-1 text-sm">
                <input type="checkbox" checked={picked.includes(m.key)} onChange={() => toggle(m.key)} />
                <span className={m.parentKey ? 'pl-3 text-ink-muted' : 'text-ink'}>{m.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() =>
          onSave({
            id,
            name,
            description: null,
            priceCents: Math.round(Number(price) * 100),
            active,
            roleId,
            // Persist only sellable (non-admin) modules — strips any admin module
            // that may have been linked to the plan previously.
            moduleKeys: picked.filter((k) => modules.some((m) => m.key === k)),
          })
        }
        disabled={!id || !name}
        className="mt-5 h-10 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse disabled:opacity-50"
      >
        Save subscription
      </button>
    </div>
  );
}
