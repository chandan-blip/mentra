import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, GraduationCap, Trophy } from 'lucide-react';
import { Card } from '@mentra/ui';
import type { LearningCategoryView, LearningTestSummary } from '@mentra/shared';
import { PageHeader } from '../../components/PageHeader.js';
import { useLearningCategories } from '../../lib/learning.js';

/**
 * Learning — a test-series library. Categories are AI-generated from the student's
 * roadmap + profile, but are fully detached from roadmap completion: any test is
 * takeable at any time. Each category is a Beginner→Intermediate→Advanced ladder.
 */

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

export function LearningPage() {
  const { data: categories, isLoading } = useLearningCategories();

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto w-full max-w-8xl space-y-6"
    >
      <motion.div variants={fadeUp}>
        <PageHeader
          icon={<GraduationCap />}
          title="Learning"
          subtitle="Test your skills across categories — take a series and track your mastery."
        />
      </motion.div>

      {isLoading && !categories ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <PlaceholderCard key={i} />
          ))}
        </div>
      ) : (categories?.length ?? 0) === 0 ? (
        <Card className="text-sm text-ink-muted">
          Your test series are being prepared — check back in a moment.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories!.map((c) => (
            <motion.div key={c.id} variants={fadeUp}>
              <CategoryCard category={c} />
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function CategoryCard({ category: c }: { category: LearningCategoryView }) {
  const navigate = useNavigate();
  const passed = c.tests.filter((t) => t.passed).length;
  return (
    <button
      type="button"
      onClick={() => navigate(`/learning/${c.id}`)}
      className="group h-full w-full text-left"
    >
      <Card interactive className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-snug text-ink">{c.title}</h3>
          {c.seriesCompleted ? <Trophy className="size-4 shrink-0 text-accent-green" /> : null}
        </div>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-ink-muted">{c.description}</p>

        {c.skillTags.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.skillTags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-muted ring-1 ring-border-subtle"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-auto pt-4">
          <LadderBar tests={c.tests} />
          <div className="mt-2 flex items-center justify-between text-xs text-ink-faint">
            <span>{passed}/{c.tests.length} passed</span>
            <span className="inline-flex items-center gap-1 font-medium text-ink-muted transition group-hover:text-ink">
              Open series <ArrowRight className="size-3.5" />
            </span>
          </div>
        </div>
      </Card>
    </button>
  );
}

/** Three-segment ladder progress: green = passed, filled-muted = attempted, empty = untouched. */
function LadderBar({ tests }: { tests: LearningTestSummary[] }) {
  return (
    <div className="flex gap-1.5">
      {tests.map((t) => (
        <span
          key={t.id}
          title={`${t.title}${t.passed ? ' · passed' : t.attempts ? ` · best ${t.bestPercent}%` : ''}`}
          className={`h-1.5 flex-1 rounded-full ${
            t.passed ? 'bg-accent-green' : t.attempts ? 'bg-ink-faint/50' : 'bg-surface-sunken'
          }`}
        />
      ))}
    </div>
  );
}

function PlaceholderCard() {
  return (
    <Card className="flex h-full flex-col">
      <div className="h-4 w-2/3 rounded bg-surface-sunken" />
      <div className="mt-2 h-3 w-full rounded bg-surface-sunken" />
      <div className="mt-1.5 h-3 w-4/5 rounded bg-surface-sunken" />
      <div className="mt-auto pt-6">
        <div className="h-1.5 w-full rounded-full bg-surface-sunken" />
      </div>
    </Card>
  );
}
