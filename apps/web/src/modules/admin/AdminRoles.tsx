import { useMemo, useState } from 'react';
import { useAdminModules, useAdminRoles, useRolePermissions, useSaveRole, useSetRolePermission } from '../../lib/admin.js';
import { AdminPageShell } from './AdminPageShell.js';
import { Switch } from '../../components/Switch.js';

export function AdminRolesPage() {
  const { data: roles } = useAdminRoles();
  const { data: modules } = useAdminModules();
  const [roleId, setRoleId] = useState<string>('');
  const active = roleId || roles?.[0]?.id || '';
  const { data: perms } = useRolePermissions(active || undefined);
  const setPerm = useSetRolePermission(active);
  const saveRole = useSaveRole();

  const permMap = useMemo(() => new Map((perms ?? []).map((p) => [p.moduleKey, p])), [perms]);
  const role = roles?.find((r) => r.id === active);

  return (
    <AdminPageShell title="Roles & permissions" subtitle="Control read/write access to each module, per role.">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(roles ?? []).map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRoleId(r.id)}
            className={['rounded-md px-3 py-1.5 text-sm ring-1 transition', r.id === active ? 'bg-surface-inverse text-ink-inverse ring-transparent' : 'bg-surface-sunken text-ink ring-border-subtle hover:ring-border-strong'].join(' ')}
          >
            {r.label}
            {r.isAdmin ? ' ★' : ''}
          </button>
        ))}
        <NewRoleButton onCreate={(id, label) => saveRole.mutate({ id, label, description: null, isAdmin: false })} />
      </div>

      {role?.isAdmin ? (
        <p className="text-sm text-ink-muted">Admins manage the platform — their sidebar shows the management modules.</p>
      ) : (
        <div className="overflow-hidden rounded-md ring-1 ring-border-subtle">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-ink-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Module</th>
                <th className="px-4 py-2 text-center font-medium">Read</th>
                <th className="px-4 py-2 text-center font-medium">Write</th>
              </tr>
            </thead>
            <tbody>
              {(modules ?? []).map((m) => {
                const p = permMap.get(m.key);
                const canRead = p?.canRead ?? false;
                const canWrite = p?.canWrite ?? false;
                return (
                  <tr key={m.key} className="border-t border-border-subtle">
                    <td className="px-4 py-2">
                      {m.label}
                      <span className="ml-2 text-xs text-ink-faint">{m.key}</span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Switch aria-label={`${m.label}: can read`} checked={canRead} onChange={(next) => setPerm.mutate({ moduleKey: m.key, canRead: next, canWrite: next ? canWrite : false })} />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Switch aria-label={`${m.label}: can write`} checked={canWrite} onChange={(next) => setPerm.mutate({ moduleKey: m.key, canRead: canRead || next, canWrite: next })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageShell>
  );
}

function NewRoleButton({ onCreate }: { onCreate: (id: string, label: string) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-ink-muted hover:text-ink">
        + New role
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Role name" className="auth-input-plain h-9 w-40" />
      <button
        type="button"
        onClick={() => {
          const id = label.trim().toLowerCase().replace(/\s+/g, '-');
          if (id) onCreate(id, label.trim());
          setOpen(false);
          setLabel('');
        }}
        className="rounded-md bg-surface-inverse px-3 py-1.5 text-sm text-ink-inverse"
      >
        Add
      </button>
    </span>
  );
}
