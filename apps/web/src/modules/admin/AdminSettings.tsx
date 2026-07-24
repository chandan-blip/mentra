import { Video } from 'lucide-react';
import { useAdminSettings, useUpdateAdminSettings } from '../../lib/admin.js';
import { AdminPageShell } from './AdminPageShell.js';
import { Switch } from '../../components/Switch.js';

/**
 * Admin → Settings. Global, admin-managed platform toggles. Today it hosts the
 * live-session recording kill switch: when off, going live no longer starts an
 * egress recording, so sessions are broadcast-only.
 */
export function AdminSettingsPage() {
  const { data: settings, isLoading } = useAdminSettings();
  const update = useUpdateAdminSettings();

  const recordOn = settings?.recordLiveSessions ?? false;

  return (
    <AdminPageShell title="Settings" subtitle="Global platform controls that apply to everyone.">
      <div className="max-w-2xl space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-lg bg-surface p-5 ring-1 ring-border-subtle">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-surface-sunken text-accent-blue ring-1 ring-border-subtle">
              <Video className="size-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">Record live sessions</h3>
              <p className="mt-1 text-sm text-ink-muted">
                When enabled, every live session is recorded to storage as a mentor goes live and
                becomes available as a replay. Turn this off to broadcast live sessions without
                recording them.
              </p>
            </div>
          </div>
          <Switch
            checked={recordOn}
            disabled={isLoading || update.isPending}
            aria-label="Record live sessions"
            onChange={(next) => update.mutate({ recordLiveSessions: next })}
          />
        </div>

        {update.isError ? (
          <p className="text-sm text-accent-red">Couldn’t save the setting. Please try again.</p>
        ) : null}
        <p className="text-xs text-ink-faint">
          Changes apply to sessions started after the toggle is switched — sessions already live are
          unaffected.
        </p>
      </div>
    </AdminPageShell>
  );
}
