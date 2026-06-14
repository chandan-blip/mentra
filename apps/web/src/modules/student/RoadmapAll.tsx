import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader.js';
import { RoadmapItemCard } from '../../components/roadmap/RoadmapItemCard.js';
import { RoadmapTabs } from '../../components/roadmap/RoadmapTabs.js';
import { useRoadmap, useRoadmapItemAction } from '../../lib/roadmap.js';

export function RoadmapAllPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useRoadmap();
  const action = useRoadmapItemAction();

  if (isLoading) {
    return <div className="grid min-h-[60vh] place-items-center text-ink-muted">Loading…</div>;
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-8xl">
        <PageHeader icon={<Target />} title="Your roadmap" />
        <RoadmapTabs />
        <p className="mt-6 max-w-xl text-sm leading-6 text-ink-muted">
          No active roadmap yet. Complete the assessment to generate one.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-8xl">
      <PageHeader
        icon={<Target />}
        title="Your roadmap"
        subtitle={`All ${data.totalWeeks} weeks · ${data.completedItems}/${data.totalItems} items complete`}
      />

      <RoadmapTabs />

      <div className="mt-6 space-y-8">
        {data.weeks.map((week, wi) => {
          const isCurrent = week.weekNumber === data.currentWeek;
          return (
            <motion.section
              key={week.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(wi * 0.03, 0.2) }}
            >
              <div className="mb-3 flex items-baseline gap-3">
                <div className="text-lg font-semibold text-ink">
                  Week {week.weekNumber}: {week.title}
                </div>
                {week.theme ? <div className="text-sm text-ink-muted">{week.theme}</div> : null}
                {isCurrent ? (
                  <span className="rounded-sm bg-surface-inverse px-2 py-0.5 text-[10px] font-medium text-ink-inverse">
                    Current
                  </span>
                ) : null}
              </div>
              {week.items.length === 0 ? (
                <p className="text-sm text-ink-faint">No items this week.</p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {week.items.map((item) => (
                    <RoadmapItemCard
                      key={item.id}
                      item={item}
                      pending={action.isPending}
                      onAction={(a) => action.mutate({ itemId: item.id, action: a })}
                      onOpen={() => navigate(`/roadmap/item/${item.id}`)}
                    />
                  ))}
                </div>
              )}
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}
