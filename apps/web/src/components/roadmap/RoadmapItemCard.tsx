import {
  BookOpen,
  Calendar,
  Check,
  ClipboardCheck,
  Code2,
  Dumbbell,
  FileText,
  Lock,
} from 'lucide-react';
import type { RoadmapItemView } from '@mentra/shared';
import { Card } from '@mentra/ui';

export const ROADMAP_TYPE_ICON: Record<
  RoadmapItemView['type'],
  React.ComponentType<{ className?: string }>
> = {
  topic: BookOpen,
  project: Code2,
  assessment: ClipboardCheck,
  session: Calendar,
  reading: FileText,
  practice: Dumbbell,
};

export const ROADMAP_STATUS_BADGE: Record<RoadmapItemView['status'], { label: string; cls: string }> = {
  available: { label: 'Available', cls: 'text-ink' },
  in_progress: { label: 'In progress', cls: 'text-accent-amber' },
  completed: { label: 'Completed', cls: 'text-accent-green' },
  locked: { label: 'Locked', cls: 'text-ink-faint' },
  skipped: { label: 'Skipped', cls: 'text-ink-muted' },
};

type ItemAction = 'start' | 'complete';

/**
 * Presentational roadmap item card. Shared across the week view, the all-weeks view
 * and read-only history. When `onOpen` is set the whole card opens the drilldown;
 * when `onAction` is set and the item is actionable, inline start/complete show.
 */
export function RoadmapItemCard({
  item,
  onAction,
  onOpen,
  pending = false,
  readOnly = false,
}: {
  item: RoadmapItemView;
  onAction?: (action: ItemAction) => void;
  onOpen?: () => void;
  pending?: boolean;
  readOnly?: boolean;
}) {
  const Icon = ROADMAP_TYPE_ICON[item.type];
  const badge = ROADMAP_STATUS_BADGE[item.status];
  const locked = item.status === 'locked';
  const done = item.status === 'completed' || item.status === 'skipped';
  const isTopic = item.type === 'topic';
  // Topics complete only by passing their test, which lives in the drilldown — so
  // they never show the generic start/complete buttons here.
  const showActions = !readOnly && !done && !locked && Boolean(onAction) && !isTopic;
  const showTopicCta = !readOnly && !done && !locked && isTopic && Boolean(onOpen);

  return (
    <Card
      className={[
        'flex flex-col',
        locked ? 'opacity-60' : '',
        onOpen ? 'cursor-pointer transition hover:ring-border-strong' : '',
      ].join(' ')}
      onClick={onOpen}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-raised text-ink-muted">
          {locked ? <Lock className="size-4" /> : <Icon className="size-4" />}
        </span>
        <span className={`text-xs font-medium ${badge.cls}`}>{badge.label}</span>
      </div>
      <div className="text-sm font-medium text-ink">{item.title}</div>
      {item.description ? (
        <div className="mt-1 line-clamp-2 text-xs leading-5 text-ink-muted">{item.description}</div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-sm bg-surface-sunken px-2 py-0.5 text-[10px] capitalize text-ink-faint ring-1 ring-border-subtle">
          {item.type}
        </span>
        {item.estimatedMin ? (
          <span className="text-[10px] text-ink-faint">~{item.estimatedMin} min</span>
        ) : null}
      </div>

      {showActions ? (
        <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
          {item.status === 'available' ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onAction?.('start')}
              className="h-9 flex-1 rounded-md bg-surface-sunken text-sm text-ink ring-1 ring-border-subtle transition hover:ring-border-strong disabled:opacity-50"
            >
              Start
            </button>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => onAction?.('complete')}
            className="flex h-9 flex-1 items-center justify-center gap-1 rounded-md bg-surface-inverse text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
          >
            <Check className="size-4" /> Complete
          </button>
        </div>
      ) : showTopicCta ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen?.();
          }}
          className="mt-4 flex h-9 items-center justify-center gap-1 rounded-md bg-surface-inverse text-sm font-semibold text-ink-inverse transition hover:bg-ink"
        >
          <ClipboardCheck className="size-4" /> Take test to complete
        </button>
      ) : locked && !readOnly ? (
        <div className="mt-4 text-xs text-ink-faint">Complete the previous week to unlock.</div>
      ) : null}
    </Card>
  );
}
