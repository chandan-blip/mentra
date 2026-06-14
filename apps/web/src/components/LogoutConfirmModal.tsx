import { AnimatePresence, motion } from 'framer-motion';
import { LogOut } from 'lucide-react';

export function LogoutConfirmModal({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-canvas-deep/72 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
          onMouseDown={onCancel}
        >
          <motion.div
            className="w-full max-w-sm rounded-lg bg-surface p-5 shadow-card ring-1 ring-border"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-surface-sunken text-ink ring-1 ring-border-subtle">
              <LogOut className="size-5" />
            </div>
            <h2 id="logout-title" className="text-lg font-semibold text-ink">
              Log out?
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Your current session will end on this device. You can sign in again anytime.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="h-11 rounded-md bg-surface-sunken px-4 text-sm font-medium text-ink ring-1 ring-border-subtle transition hover:bg-surface-raised"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="h-11 rounded-md bg-surface-inverse px-4 text-sm font-semibold text-ink-inverse transition hover:bg-ink"
              >
                Log out
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
