import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { IconButton } from '@mentra/ui';
import type { NotificationView } from '@mentra/shared';
import { formatAgo } from '../lib/community.js';
import { useMarkAllRead, useMarkRead, useNotifications, useUnreadCount } from '../lib/notifications.js';

/**
 * Header notification bell: shows an unread badge (polled), and a slide-in
 * offcanvas drawer listing the user's notifications. Clicking one marks it read
 * and navigates to its link.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const unread = useUnreadCount();
  const list = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  const count = unread.data?.count ?? 0;
  const items = list.data ?? [];

  function openItem(n: NotificationView) {
    if (!n.read) markRead.mutate(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  return (
    <>
      <div className="relative">
        <IconButton variant="dark" size="md" label="Notifications" onClick={() => setOpen(true)}>
          <Bell />
        </IconButton>
        {count > 0 ? (
          <span className="pointer-events-none absolute -right-0.5 -top-0.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-accent-red px-1 text-[10px] font-bold leading-none text-white ring-2 ring-canvas">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </div>

      {createPortal(
      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-[60] bg-canvas-deep/72 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onMouseDown={() => setOpen(false)}
          >
            <motion.aside
              className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-surface shadow-xl ring-1 ring-border-subtle"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 38 }}
              role="dialog"
              aria-modal="true"
              aria-label="Notifications"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3.5">
                <span className="text-sm font-semibold text-ink">Notifications</span>
                <div className="flex items-center gap-1">
                  {count > 0 ? (
                    <button
                      type="button"
                      onClick={() => markAll.mutate()}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
                    >
                      <CheckCheck className="size-3.5" /> Mark all read
                    </button>
                  ) : null}
                  <IconButton variant="dark" size="sm" label="Close notifications" onClick={() => setOpen(false)}>
                    <X />
                  </IconButton>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                {list.isLoading ? (
                  <div className="px-4 py-6 text-center text-sm text-ink-muted">Loading…</div>
                ) : items.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-ink-muted">You're all caught up 🎉</div>
                ) : (
                  items.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => openItem(n)}
                      className={`flex w-full items-start gap-2.5 border-b border-border-subtle px-4 py-3 text-left transition hover:bg-surface-sunken ${
                        n.read ? '' : 'bg-accent-blue/5'
                      }`}
                    >
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-accent-blue'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">{n.title}</span>
                        {n.body ? <span className="mt-0.5 block truncate text-xs text-ink-muted">{n.body}</span> : null}
                        <span className="mt-0.5 block text-[11px] text-ink-faint">{formatAgo(n.createdAt)}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>,
      document.body,
      )}
    </>
  );
}
