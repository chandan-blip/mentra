import { useAdminPlans, useAdminRoles, useAdminUsers, useAssignUser } from '../../lib/admin.js';
import { AdminPageShell } from './AdminPageShell.js';

export function AdminUsersPage() {
  const { data: users } = useAdminUsers();
  const { data: roles } = useAdminRoles();
  const { data: plans } = useAdminPlans();
  const assign = useAssignUser();

  return (
    <AdminPageShell title="Users" subtitle="Assign each user a role and a subscription plan.">
      <div className="overflow-hidden rounded-md ring-1 ring-border-subtle">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken text-ink-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">User</th>
              <th className="px-4 py-2 text-left font-medium">Role</th>
              <th className="px-4 py-2 text-left font-medium">Subscription</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id} className="border-t border-border-subtle">
                <td className="px-4 py-2">
                  <div className="text-ink">{u.name}</div>
                  <div className="text-xs text-ink-faint">{u.email}</div>
                </td>
                <td className="px-4 py-2">
                  <select
                    value={u.roleId ?? ''}
                    onChange={(e) => assign.mutate({ userId: u.id, roleId: e.target.value || null, planId: u.planId })}
                    className="rounded-md bg-surface-sunken px-2 py-1.5 text-sm text-ink ring-1 ring-border-subtle"
                  >
                    <option value="">(default: {u.role})</option>
                    {(roles ?? []).map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <select
                    value={u.planId ?? ''}
                    onChange={(e) => assign.mutate({ userId: u.id, roleId: u.roleId, planId: e.target.value || null })}
                    className="rounded-md bg-surface-sunken px-2 py-1.5 text-sm text-ink ring-1 ring-border-subtle"
                  >
                    <option value="">(default plan)</option>
                    {(plans ?? []).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPageShell>
  );
}
