import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Circle, Clock, Trophy } from 'lucide-react';
import type { CodingDifficulty, CodingTaskListItem } from '@mentra/shared';
import { useCodingProgress, useCodingTasks } from '../../lib/coding.js';

/**
 * Coding — the student's task list. A "correct %" stat row (passed tasks / total), then a
 * grid of tasks with their solve status. Clicking a task opens the split-pane solver at
 * /coding/:taskId.
 */

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

const DIFFICULTY_BADGE: Record<CodingDifficulty, string> = {
  beginner: 'bg-accent-green/10 text-accent-green ring-accent-green/20',
  intermediate: 'bg-accent-amber/10 text-accent-amber ring-accent-amber/20',
  advanced: 'bg-accent-red/10 text-accent-red ring-accent-red/20',
};

export function CodingPage() {
  const { data: tasks, isLoading } = useCodingTasks();
  const { data: progress } = useCodingProgress();

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto w-full max-w-8xl space-y-6 pt-4 md:pt-0"
    >
      <motion.div variants={fadeUp} className="grid grid-cols-3 gap-2 sm:gap-4">
        <StatTile label="Correct" value={`${progress?.correctPercent ?? 0}%`} icon={<Trophy className="size-5" />} accent />
        <StatTile label="Questions solved" value={`${progress?.solved ?? 0}/${progress?.totalQuestions ?? 0}`} icon={<CheckCircle2 className="size-5" />} />
        <StatTile label="Attempted" value={`${progress?.attempted ?? 0}`} icon={<Clock className="size-5" />} />
      </motion.div>

      <motion.div variants={fadeUp}>
        {isLoading ? (
          <div className="rounded-lg bg-surface p-8 text-center text-sm text-ink-faint ring-1 ring-border-subtle">
            Loading tasks…
          </div>
        ) : (tasks ?? []).length === 0 ? (
          <div className="rounded-lg bg-surface p-8 text-center text-sm text-ink-faint ring-1 ring-border-subtle">
            No coding tasks yet. Check back soon.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(tasks ?? []).map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function StatTile({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 rounded-lg p-3 text-center ring-1 sm:flex-row sm:gap-3 sm:p-4 sm:text-left ${
        accent
          ? 'bg-surface-inverse text-ink-inverse ring-transparent'
          : 'bg-surface text-ink ring-border-subtle'
      }`}
    >
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-md sm:size-10 [&_svg]:size-4 sm:[&_svg]:size-5 ${
          accent ? 'bg-white/10 text-ink-inverse' : 'bg-surface-sunken text-ink-muted'
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-base font-semibold leading-none sm:text-2xl">{value}</div>
        <div className={`mt-1 truncate text-[10px] leading-tight sm:text-xs ${accent ? 'text-ink-inverse-muted' : 'text-ink-faint'}`}>{label}</div>
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: CodingTaskListItem }) {
  const navigate = useNavigate();
  const status = useMemo(() => statusMeta(task), [task]);
  return (
    <button
      type="button"
      onClick={() => navigate(`/coding/${task.id}`)}
      className="group flex flex-col gap-3 rounded-lg bg-surface p-4 text-left ring-1 ring-border-subtle transition hover:ring-border-strong"
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${status.className}`}>
          {status.icon}
          {status.label}
        </span>
        <span className={`rounded-sm px-2 py-0.5 text-xs capitalize ring-1 ${DIFFICULTY_BADGE[task.difficulty]}`}>
          {task.difficulty}
        </span>
      </div>
      <h3 className="line-clamp-2 font-medium text-ink">{task.title}</h3>
      <div className="mt-auto space-y-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
          <div
            className={`h-full rounded-full ${task.status === 'passed' ? 'bg-accent-green' : 'bg-surface-inverse'}`}
            style={{ width: `${task.percent}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-muted">
            {task.solvedCount}/{task.questionCount} question{task.questionCount === 1 ? '' : 's'}
          </span>
          <ArrowRight className="size-4 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
        </div>
      </div>
    </button>
  );
}

function statusMeta(task: CodingTaskListItem): { label: string; className: string; icon: React.ReactNode } {
  if (task.status === 'passed') {
    return { label: 'Completed', className: 'text-accent-green', icon: <CheckCircle2 className="size-4" /> };
  }
  if (task.status === 'attempted') {
    return {
      label: `In progress · ${task.percent}%`,
      className: 'text-accent-amber',
      icon: <Clock className="size-4" />,
    };
  }
  return { label: 'Not started', className: 'text-ink-faint', icon: <Circle className="size-4" /> };
}
