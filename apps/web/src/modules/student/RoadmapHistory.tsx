import { useState } from 'react';
import { motion } from 'framer-motion';
import { Archive, ChevronRight } from 'lucide-react';
import type { RoadmapHistoryEntry } from '@mentra/shared';
import { Badge, Card } from '@mentra/ui';
import { PageHeader } from '../../components/PageHeader.js';
import { RoadmapItemCard } from '../../components/roadmap/RoadmapItemCard.js';
import { RoadmapTabs } from '../../components/roadmap/RoadmapTabs.js';
import { useRoadmapHistory, useRoadmapHistoryDetail } from '../../lib/roadmap.js';

const STATUS_LABEL: Record<RoadmapHistoryEntry['status'], string> = {
  active: 'Active',
  archived: 'Archived',
  superseded: 'Superseded',
};

export function RoadmapHistoryPage() {
  const { data: entries, isLoading } = useRoadmapHistory();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: detail, isLoading: detailLoading } = useRoadmapHistoryDetail(selectedId ?? undefined);

  const past = (entries ?? []).filter((e) => e.status !== 'active');

  return (
    <div className="mx-auto w-full max-w-8xl">
      <PageHeader
        icon={<Archive />}
        title="Roadmap history"
        subtitle="Previous plans, archived when you regenerated."
      />

      <RoadmapTabs />

      {isLoading ? (
        <div className="mt-6 text-sm text-ink-muted">Loading…</div>
      ) : past.length === 0 ? (
        <Card className="mt-6 max-w-xl">
          <p className="text-sm leading-6 text-ink-muted">
            No past roadmaps yet. When you regenerate your roadmap, the previous version is
            archived and shows up here, read-only.
          </p>
        </Card>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Entry list */}
          <div className="space-y-2">
            {past.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedId(entry.id)}
                className={[
                  'flex w-full items-center gap-3 rounded-md p-3 text-left ring-1 transition',
                  entry.id === selectedId
                    ? 'bg-surface-raised ring-border-strong'
                    : 'bg-surface-sunken ring-border-subtle hover:ring-border-strong',
                ].join(' ')}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-raised text-ink-muted">
                  <Archive className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">{entry.totalWeeks}-week plan</span>
                    <Badge variant="outline" size="md">
                      {STATUS_LABEL[entry.status]}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-faint">
                    {new Date(entry.startedOn).toLocaleDateString()}
                    {entry.archivedAt
                      ? ` → ${new Date(entry.archivedAt).toLocaleDateString()}`
                      : ''}
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-ink-faint" />
              </button>
            ))}
          </div>

          {/* Read-only detail */}
          <div>
            {!selectedId ? (
              <Card className="grid min-h-[40vh] place-items-center text-sm text-ink-muted">
                Select a roadmap to view it.
              </Card>
            ) : detailLoading || !detail ? (
              <div className="text-sm text-ink-muted">Loading…</div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="text-sm text-ink-muted">
                  {detail.completedItems}/{detail.totalItems} items completed across {detail.totalWeeks}{' '}
                  weeks
                </div>
                {detail.weeks.map((week) => (
                  <section key={week.id}>
                    <div className="mb-3 text-base font-semibold text-ink">
                      Week {week.weekNumber}: {week.title}
                    </div>
                    {week.items.length === 0 ? (
                      <p className="text-sm text-ink-faint">No items.</p>
                    ) : (
                      <div className="grid gap-3 lg:grid-cols-2">
                        {week.items.map((item) => (
                          <RoadmapItemCard key={item.id} item={item} readOnly />
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
