import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@mentra/ui';
import { PageHeader } from '../../components/PageHeader.js';
import { RoadmapItemCard } from '../../components/roadmap/RoadmapItemCard.js';
import { RoadmapTabs } from '../../components/roadmap/RoadmapTabs.js';
import { StickyRevealBar } from '../../components/StickyRevealBar.js';
import { useRoadmap, useRoadmapItemAction } from '../../lib/roadmap.js';

export function RoadmapPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useRoadmap();
  const action = useRoadmapItemAction();
  const [week, setWeek] = useState<number | null>(null);

  if (isLoading) {
    return <div className="grid min-h-[60vh] place-items-center text-ink-muted">Loading…</div>;
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-8xl">
        <PageHeader icon={<Target />} title="Your roadmap" />
        <Card className="mt-6 max-w-xl">
          <p className="text-sm leading-6 text-ink-muted">
            Your personalized roadmap is generated from your skill matrix. Take the initial
            assessment and a multi-week plan will appear here.
          </p>
          <button
            type="button"
            onClick={() => navigate('/assessment')}
            className="mt-5 h-11 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse transition hover:bg-ink"
          >
            Take the assessment
          </button>
        </Card>
      </div>
    );
  }

  const current = week ?? data.currentWeek;
  const activeWeek = data.weeks.find((w) => w.weekNumber === current) ?? data.weeks[0];

  return (
    <div className="mx-auto w-full max-w-8xl">
      <PageHeader
        icon={<Target />}
        title="Your roadmap"
        subtitle={`${data.totalWeeks} weeks · ${data.completedItems}/${data.totalItems} items complete`}
      />

      {/* Tabs + progress + week switcher (pagination) — reveal a fixed copy from the top on
          scroll, so the controls stay reachable while browsing a week's items. */}
      <StickyRevealBar>
        <RoadmapTabs />

        {/* Progress */}
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
          <div className="h-full rounded-full bg-accent-green transition-all" style={{ width: `${data.percentComplete}%` }} />
        </div>

        {/* Week switcher */}
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setWeek(Math.max(1, current - 1))}
            disabled={current <= 1}
            className="flex size-9 items-center justify-center rounded-md bg-surface-sunken text-ink ring-1 ring-border-subtle disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex items-center gap-2">
            {data.weeks.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWeek(w.weekNumber)}
                className={[
                  'size-2.5 rounded-full transition',
                  w.weekNumber === current ? 'bg-surface-inverse' : 'bg-surface-sunken ring-1 ring-border-subtle',
                ].join(' ')}
                aria-label={`Week ${w.weekNumber}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setWeek(Math.min(data.totalWeeks, current + 1))}
            disabled={current >= data.totalWeeks}
            className="flex size-9 items-center justify-center rounded-md bg-surface-sunken text-ink ring-1 ring-border-subtle disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </StickyRevealBar>

      {/* Week content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeWeek?.id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="mt-6"
        >
          <div className="mb-4">
            <div className="text-lg font-semibold text-ink">
              Week {activeWeek?.weekNumber}: {activeWeek?.title}
            </div>
            {activeWeek?.theme ? <div className="text-sm text-ink-muted">{activeWeek.theme}</div> : null}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {(activeWeek?.items ?? []).map((item) => (
              <RoadmapItemCard
                key={item.id}
                item={item}
                pending={action.isPending}
                onAction={(a) => action.mutate({ itemId: item.id, action: a })}
                onOpen={() => navigate(`/roadmap/item/${item.id}`)}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
