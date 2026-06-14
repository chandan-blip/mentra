import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/** Shared frame for the admin module pages (heading + back link). */
export function AdminPageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="mx-auto w-full max-w-8xl"
    >
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        className="mb-5 flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Admin overview
      </button>
      <h1 className="text-display-md tracking-normal">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
      <div className="mt-6">{children}</div>
    </motion.div>
  );
}
