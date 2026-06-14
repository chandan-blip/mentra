import { motion } from 'framer-motion';
import { ArrowLeft, Check, Lock } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import type { RoadmapItemView } from '@mentra/shared';
import { Card } from '@mentra/ui';
import {
  ROADMAP_STATUS_BADGE,
  ROADMAP_TYPE_ICON,
} from '../../components/roadmap/RoadmapItemCard.js';
import { RoadmapTopicPanel } from '../../components/roadmap/RoadmapTopicPanel.js';
import { useRoadmap, useRoadmapItemAction } from '../../lib/roadmap.js';

export function RoadmapItemPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useRoadmap();
  const action = useRoadmapItemAction();

  if (isLoading) {
    return <div className="grid min-h-[60vh] place-items-center text-ink-muted">Loading…</div>;
  }

  const allItems = data?.weeks.flatMap((w) => w.items.map((it) => ({ item: it, week: w }))) ?? [];
  const found = allItems.find((x) => x.item.id === id);

  if (!found) {
    return (
      <div className="mx-auto max-w-2xl">
        <BackLink onClick={() => navigate('/roadmap')} />
        <Card className="mt-4">
          <p className="text-sm leading-6 text-ink-muted">
            This item isn&apos;t part of your active roadmap. It may belong to a previous,
            archived plan.
          </p>
        </Card>
      </div>
    );
  }

  const { item, week } = found;
  const Icon = ROADMAP_TYPE_ICON[item.type];
  const badge = ROADMAP_STATUS_BADGE[item.status];
  const locked = item.status === 'locked';
  const done = item.status === 'completed' || item.status === 'skipped';
  const isTopic = item.type === 'topic';

  const byId = new Map(allItems.map((x) => [x.item.id, x.item]));
  const deps = item.dependsOnIds
    .map((depId) => byId.get(depId))
    .filter((d): d is RoadmapItemView => Boolean(d));
  const unmetDeps = deps.filter((d) => d.status !== 'completed' && d.status !== 'skipped');

  const run = (a: 'start' | 'complete') =>
    action.mutate({ itemId: item.id, action: a });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl"
    >
      <BackLink onClick={() => navigate(-1)} />

      <Card className="mt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-raised text-ink-muted">
              {locked ? <Lock className="size-5" /> : <Icon className="size-5" />}
            </span>
            <div>
              <div className="text-xs text-ink-faint">
                Week {week.weekNumber} · <span className="capitalize">{item.type}</span>
                {item.estimatedMin ? ` · ~${item.estimatedMin} min` : ''}
              </div>
              <h1 className="text-display-sm tracking-normal">{item.title}</h1>
            </div>
          </div>
          <span className={`shrink-0 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
        </div>

        {item.description ? (
          <p className="mt-5 text-sm leading-6 text-ink-muted">{item.description}</p>
        ) : null}

        {item.skillIds.length > 0 ? (
          <div className="mt-5">
            <div className="mb-1.5 text-xs font-medium text-ink-muted">Skills</div>
            <div className="flex flex-wrap gap-1.5">
              {item.skillIds.map((s) => (
                <span
                  key={s}
                  className="rounded-sm bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-faint ring-1 ring-border-subtle"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {deps.length > 0 ? (
          <div className="mt-5">
            <div className="mb-1.5 text-xs font-medium text-ink-muted">Prerequisites</div>
            <ul className="space-y-1">
              {deps.map((d) => {
                const ok = d.status === 'completed' || d.status === 'skipped';
                return (
                  <li key={d.id} className="flex items-center gap-2 text-sm">
                    {ok ? (
                      <Check className="size-4 text-accent-green" />
                    ) : (
                      <Lock className="size-4 text-ink-faint" />
                    )}
                    <span className={ok ? 'text-ink-muted line-through' : 'text-ink'}>{d.title}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {/* Topics carry their full subtopic breakdown + a completion test; other
            item types keep the simple content placeholder until 07-content-delivery. */}
        {isTopic ? (
          <RoadmapTopicPanel item={item} />
        ) : item.type !== 'assessment' ? (
          <div className="mt-5 rounded-md bg-surface-sunken p-3 text-xs leading-5 text-ink-faint ring-1 ring-border-subtle">
            Lesson content links will appear here once the content module ships.
          </div>
        ) : null}

        {/* Topics are completed by passing the test (handled in the panel above), so
            they don't get the generic start/complete buttons. */}
        {!isTopic && !done && !locked ? (
          <div className="mt-6 flex gap-2">
            {item.status === 'available' ? (
              <button
                type="button"
                disabled={action.isPending}
                onClick={() => run('start')}
                className="h-11 flex-1 rounded-md bg-surface-sunken text-sm font-medium text-ink ring-1 ring-border-subtle transition hover:ring-border-strong disabled:opacity-50"
              >
                Start
              </button>
            ) : null}
            <button
              type="button"
              disabled={action.isPending}
              onClick={() => run('complete')}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md bg-surface-inverse text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
            >
              <Check className="size-4" /> Mark complete
            </button>
          </div>
        ) : locked ? (
          <div className="mt-6 rounded-md bg-surface-sunken p-3 text-sm text-ink-muted ring-1 ring-border-subtle">
            {unmetDeps.length > 0
              ? `Complete ${unmetDeps.map((d) => `“${d.title}”`).join(', ')} to unlock this item.`
              : 'Complete the previous week to unlock this item.'}
          </div>
        ) : done ? (
          <div className="mt-6 text-sm text-ink-muted">
            {item.status === 'completed' ? 'Completed' : 'Skipped'}
            {item.completedAt ? ` · ${new Date(item.completedAt).toLocaleDateString()}` : ''}
          </div>
        ) : null}
      </Card>
    </motion.div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink"
    >
      <ArrowLeft className="size-4" /> Back to roadmap
    </button>
  );
}
