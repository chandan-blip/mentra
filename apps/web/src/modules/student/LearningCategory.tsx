import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Play, RotateCcw, Trophy } from 'lucide-react';
import { Card } from '@mentra/ui';
import type { LearningDifficulty, LearningTestSummary } from '@mentra/shared';
import { useLearningCategory } from '../../lib/learning.js';

/**
 * A category's test series: the Beginner → Intermediate → Advanced ladder. Every test
 * is open (no unlock gating) — the ladder is just difficulty ordering. Tapping a test
 * opens the runner.
 */

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

const DIFFICULTY_BADGE: Record<LearningDifficulty, string> = {
  beginner: 'text-accent-green',
  intermediate: 'text-accent-amber',
  advanced: 'text-accent-red',
};

export function LearningCategoryPage() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const { data: category, isLoading, isError } = useLearningCategory(categoryId);

  return (
    <div className="mx-auto w-full max-w-3xl pb-16">
      <button
        type="button"
        onClick={() => navigate('/learning')}
        aria-label="Back to Learning"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Learning
      </button>

      {isLoading && !category ? (
        <div className="grid min-h-[40vh] place-items-center text-ink-muted">Loading…</div>
      ) : isError || !category ? (
        <Card className="text-sm text-ink-muted">This category could not be found.</Card>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
        >
          <motion.div variants={fadeUp} className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="flex items-center gap-2 text-display-sm tracking-normal text-ink">
                {category.title}
                {category.seriesCompleted ? <Trophy className="size-5 text-accent-green" /> : null}
              </h1>
              <p className="mt-1 text-sm leading-6 text-ink-muted">{category.description}</p>
              {category.skillTags.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {category.skillTags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-muted ring-1 ring-border-subtle"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {category.tests.map((t, i) => (
              <motion.div key={t.id} variants={fadeUp}>
                <TestStep test={t} index={i} onOpen={() => navigate(`/learning/test/${t.id}`)} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function TestStep({
  test: t,
  index,
  onOpen,
}: {
  test: LearningTestSummary;
  index: number;
  onOpen: () => void;
}) {
  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wide ${DIFFICULTY_BADGE[t.difficulty]}`}>
          {t.title}
        </span>
        <span className="grid size-6 place-items-center rounded-full bg-surface-sunken text-xs font-semibold text-ink-muted ring-1 ring-border-subtle">
          {t.passed ? <Check className="size-3.5 text-accent-green" /> : index + 1}
        </span>
      </div>

      <div className="mt-3 text-sm text-ink-muted">
        {t.attempts > 0 ? (
          <>
            Best <span className="font-semibold text-ink">{t.bestPercent}%</span>
            <span className="text-ink-faint"> · {t.attempts} {t.attempts === 1 ? 'attempt' : 'attempts'}</span>
            {t.passed ? <span className="text-accent-green"> · passed</span> : null}
          </>
        ) : (
          <span className="text-ink-faint">Not attempted yet</span>
        )}
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-4 flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-surface-inverse text-sm font-semibold text-ink-inverse transition hover:bg-ink"
      >
        {t.attempts > 0 ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
        {t.attempts > 0 ? 'Retake' : 'Start test'}
      </button>
    </Card>
  );
}
