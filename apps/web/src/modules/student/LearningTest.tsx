import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, RotateCcw, Trophy, X } from 'lucide-react';
import type { LearningTestSubmitResult, LearningTestView } from '@mentra/shared';
import { useStartLearningTest, useSubmitLearningTest } from '../../lib/learning.js';

/**
 * Test runner — a horizontal, one-question-per-step stepper. The MCQs are AI-generated
 * server-side on first start; the runner walks them one at a time, then submits for
 * grading and shows a per-question review.
 */

export function LearningTestPage() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const start = useStartLearningTest();
  const submit = useSubmitLearningTest();

  const [test, setTest] = useState<LearningTestView | null>(null);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [graded, setGraded] = useState<LearningTestSubmitResult | null>(null);

  // Start (and generate, if needed) the test once, on mount.
  useEffect(() => {
    if (!testId) return;
    let active = true;
    start.mutate(testId, {
      onSuccess: (t) => active && setTest(t),
      onError: () => active && setFailed(true),
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  // The per-topic ladder page is bypassed — exit/back and finishing a test go straight to the list.
  const backToList = () => navigate('/learning');

  const toggle = (questionId: string, optionIndex: number, multi: boolean) => {
    setAnswers((prev) => {
      const cur = prev[questionId] ?? [];
      if (multi) {
        return {
          ...prev,
          [questionId]: cur.includes(optionIndex)
            ? cur.filter((i) => i !== optionIndex)
            : [...cur, optionIndex],
        };
      }
      return { ...prev, [questionId]: [optionIndex] };
    });
  };

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const doSubmit = () => {
    if (!test) return;
    const payload = test.questions.map((q) => ({ questionId: q.id, selected: answers[q.id] ?? [] }));
    submit.mutate(
      { testId: test.id, answers: payload },
      { onSuccess: (res) => setGraded(res) },
    );
  };

  const retake = () => {
    setGraded(null);
    setAnswers({});
    setStep(0);
    setDir(1);
  };

  // --- Loading / error ---
  if (failed) {
    return (
      <Shell onBack={() => navigate('/learning')}>
        <div className="rounded-lg bg-surface-sunken p-6 text-center text-sm text-ink-muted">
          This test could not be started. Please try again.
        </div>
      </Shell>
    );
  }
  if (!test) {
    return (
      <Shell onBack={() => navigate('/learning')}>
        <div className="grid min-h-[40vh] place-items-center">
          <div className="flex flex-col items-center gap-3 text-ink-muted">
            <span className="size-8 animate-spin rounded-full border-2 border-border-strong border-t-ink" />
            <span className="text-sm">Preparing your test…</span>
          </div>
        </div>
      </Shell>
    );
  }

  // --- Graded review ---
  if (graded) {
    return (
      <Shell onBack={backToList}>
        <GradedView test={test} graded={graded} onRetake={retake} onDone={backToList} />
      </Shell>
    );
  }

  // --- Taking (horizontal stepper) ---
  const total = test.questions.length;
  const q = test.questions[step]!;
  const multi = q.type === 'multi_choice';
  const sel = answers[q.id] ?? [];
  const answered = sel.length > 0;
  const isLast = step === total - 1;

  return (
    <Shell onBack={backToList}>
      {/* Step progress */}
      <div className="mb-1 flex items-center justify-between text-xs text-ink-faint">
        <span className="font-medium text-ink-muted">{test.title} test</span>
        <span>Question {step + 1} of {total}</span>
      </div>
      <div className="mb-6 flex gap-1.5">
        {test.questions.map((qq, i) => (
          <span
            key={qq.id}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              (answers[qq.id]?.length ?? 0) > 0
                ? 'bg-surface-inverse'
                : i === step
                  ? 'bg-ink-faint/60'
                  : 'bg-surface-sunken'
            }`}
          />
        ))}
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={q.id}
            custom={dir}
            initial={{ opacity: 0, x: dir * 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -32 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          >
            <h2 className="text-lg font-semibold leading-snug text-ink">
              {q.body}
              {multi ? <span className="ml-1.5 text-xs font-normal text-ink-faint">(select all that apply)</span> : null}
            </h2>
            <div className="mt-4 space-y-2">
              {q.options.map((opt, oi) => {
                const checked = sel.includes(oi);
                return (
                  <button
                    type="button"
                    key={oi}
                    onClick={() => toggle(q.id, oi, multi)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-3 text-left text-sm ring-1 transition ${
                      checked
                        ? 'bg-surface-raised text-ink ring-border-strong'
                        : 'text-ink-muted ring-border-subtle hover:ring-border-strong'
                    }`}
                  >
                    <span
                      className={`grid size-5 shrink-0 place-items-center ${multi ? 'rounded-md' : 'rounded-full'} ring-1 ${
                        checked ? 'bg-surface-inverse text-ink-inverse ring-transparent' : 'ring-border-strong'
                      }`}
                    >
                      {checked ? <Check className="size-3.5" /> : null}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="mt-8 flex items-center gap-2">
        <button
          type="button"
          onClick={() => go(step - 1)}
          disabled={step === 0}
          className="inline-flex h-11 items-center gap-1.5 rounded-md px-4 text-sm font-medium text-ink-muted ring-1 ring-border-subtle transition hover:ring-border-strong disabled:opacity-40"
        >
          <ArrowLeft className="size-4" /> Back
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={doSubmit}
            disabled={!answered || submit.isPending}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md bg-surface-inverse text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
          >
            {submit.isPending ? 'Submitting…' : 'Submit test'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => go(step + 1)}
            disabled={!answered}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md bg-surface-inverse text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
          >
            Next <ArrowRight className="size-4" />
          </button>
        )}
      </div>
    </Shell>
  );
}

/** Column wrapper + back button, shared across the runner states. */
function Shell({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl pb-16">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Exit
      </button>
      {children}
    </div>
  );
}

function GradedView({
  test,
  graded,
  onRetake,
  onDone,
}: {
  test: LearningTestView;
  graded: LearningTestSubmitResult;
  onRetake: () => void;
  onDone: () => void;
}) {
  const r = graded.result;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div
        className={`rounded-xl p-5 ring-1 ${
          r.passed ? 'bg-accent-green/10 ring-accent-green/30' : 'bg-surface-sunken ring-border-subtle'
        }`}
      >
        <div className="flex items-center gap-2">
          <Trophy className={`size-6 ${r.passed ? 'text-accent-green' : 'text-ink-faint'}`} />
          <span className="text-display-sm tracking-normal">{r.percent}%</span>
          <span className={`text-sm font-medium ${r.passed ? 'text-accent-green' : 'text-ink-muted'}`}>
            {r.passed ? 'Passed' : `Not passed (need ${test.passPercent}%)`}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {r.score}/{r.maxScore} points · {r.correctCount}/{r.totalQuestions} correct · attempt {r.attemptNumber}
        </p>
        {graded.seriesCompleted ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent-green/15 px-3 py-1 text-xs font-semibold text-accent-green">
            <Trophy className="size-3.5" /> Series complete — every level passed!
          </p>
        ) : null}
      </div>

      <ol className="mt-4 space-y-3">
        {test.questions.map((q, i) => {
          const g = graded.graded.find((x) => x.questionId === q.id);
          const ok = g?.isCorrect ?? false;
          return (
            <li key={q.id} className="rounded-lg bg-surface-sunken p-3.5 ring-1 ring-border-subtle">
              <div className="flex items-start gap-2 text-sm">
                {ok ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-accent-green" />
                ) : (
                  <X className="mt-0.5 size-4 shrink-0 text-accent-red" />
                )}
                <span className="font-medium text-ink">
                  {i + 1}. {q.body}
                </span>
              </div>
              <div className="mt-2 space-y-1">
                {q.options.map((opt, oi) => {
                  const isCorrect = g?.correct.includes(oi);
                  const wasPicked = g?.selected.includes(oi);
                  return (
                    <div
                      key={oi}
                      className={`flex items-center gap-2 rounded-sm px-2 py-1 text-sm ${
                        isCorrect
                          ? 'text-accent-green'
                          : wasPicked
                            ? 'text-accent-red line-through'
                            : 'text-ink-faint'
                      }`}
                    >
                      {isCorrect ? (
                        <Check className="size-3.5" />
                      ) : wasPicked ? (
                        <X className="size-3.5" />
                      ) : (
                        <span className="size-3.5" />
                      )}
                      {opt}
                    </div>
                  );
                })}
              </div>
              {g?.explanation ? <p className="mt-1.5 text-xs leading-5 text-ink-muted">{g.explanation}</p> : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onRetake}
          className="inline-flex h-11 items-center gap-1.5 rounded-md px-4 text-sm font-medium text-ink-muted ring-1 ring-border-subtle transition hover:ring-border-strong"
        >
          <RotateCcw className="size-4" /> Retake
        </button>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-surface-inverse text-sm font-semibold text-ink-inverse transition hover:bg-ink"
        >
          Back to topics
        </button>
      </div>
    </motion.div>
  );
}
