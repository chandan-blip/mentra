import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, ClipboardList, Compass, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AssignmentSubmission, AssignmentTaskView, AssignmentView } from '@mentra/shared';
import { ApiError } from '../../lib/api.js';
import { PageHeader } from '../../components/PageHeader.js';
import { useAssignment, useSubmitAssignment } from '../../lib/assignment.js';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

export function AssignmentPage() {
  const { data, isLoading, error } = useAssignment();

  return (
    <div className="mx-auto w-full max-w-8xl">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          icon={<Sparkles />}
          title="Your assignment"
          subtitle="A short, personalized assignment built for you by Mentra. Complete it to calibrate your current level — your roadmap is generated from the results."
        />

        {isLoading ? (
          <Preparing />
        ) : error ? (
          <ErrorCard message={error instanceof ApiError ? error.message : 'Could not load your assignment'} />
        ) : data?.status === 'completed' ? (
          <CompletedView assignment={data} />
        ) : data ? (
          <TakeView assignment={data} />
        ) : null}
      </div>
    </div>
  );
}

function Preparing() {
  return (
    <div className="mt-10 rounded-lg bg-surface p-6 ring-1 ring-border">
      <div className="flex items-center gap-3 text-sm font-medium text-accent-amber">
        <span className="size-2 animate-pulse rounded-full bg-accent-amber" />
        Preparing your assignment…
      </div>
      <p className="mt-2 text-sm leading-6 text-ink-muted">
        Mentra is generating questions tailored to your profile. This takes a few seconds the first
        time.
      </p>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="mt-10 rounded-lg bg-surface p-6 ring-1 ring-border">
      <div className="text-sm font-medium text-accent-red">Something went wrong</div>
      <p className="mt-2 text-sm leading-6 text-ink-muted">{message}</p>
    </div>
  );
}

function CompletedView({ assignment }: { assignment: AssignmentView }) {
  const navigate = useNavigate();
  return (
    <motion.div initial="hidden" animate="visible" variants={fadeUp} className="mt-10 space-y-4">
      <div className="rounded-lg bg-surface p-6 ring-1 ring-border">
        <div className="flex items-center gap-2 text-sm font-medium text-accent-green">
          <CheckCircle2 className="size-4" /> Assignment complete
        </div>
        <p className="mt-2 text-sm leading-6 text-ink-muted">{assignment.summary}</p>
        {assignment.score !== null ? (
          <div className="mt-5 inline-flex items-baseline gap-2 rounded-md bg-surface-sunken px-4 py-3 ring-1 ring-border-subtle">
            <span className="text-display-md leading-none">{assignment.score}%</span>
            <span className="text-xs text-ink-muted">on the scored questions</span>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg bg-surface p-6 ring-1 ring-border">
        <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
          <Compass className="size-4" /> Your roadmap
        </h3>
        <p className="mt-1 text-sm leading-6 text-ink-muted">
          We&apos;ve built a personalized weekly plan from your results. It may take a moment to
          appear right after finishing.
        </p>
        <button
          type="button"
          onClick={() => navigate('/roadmap')}
          className="group mt-5 flex h-11 items-center gap-2 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse transition hover:bg-ink"
        >
          Open your roadmap
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </button>
      </div>
    </motion.div>
  );
}

function TakeView({ assignment }: { assignment: AssignmentView }) {
  const submit = useSubmitAssignment();
  const [mcq, setMcq] = useState<Record<string, number>>({});
  const [text, setText] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [closing, setClosing] = useState<Record<string, string>>({});

  const mcqTasks = assignment.tasks.filter((t) => t.type === 'mcq');
  const allMcqAnswered = mcqTasks.every((t) => typeof mcq[t.key] === 'number');
  const allClosingAnswered = assignment.closingQuestions.every((q) => (closing[q.key] ?? '').trim().length > 0);
  const canSubmit = allMcqAnswered && allClosingAnswered && !submit.isPending;

  function buildSubmission(): AssignmentSubmission {
    const taskAnswers: AssignmentSubmission['taskAnswers'] = [];
    for (const t of assignment.tasks) {
      if (t.type === 'mcq') {
        if (typeof mcq[t.key] === 'number') taskAnswers.push({ key: t.key, answer: mcq[t.key]! });
      } else {
        taskAnswers.push({ key: t.key, answer: (text[t.key] ?? '').trim(), selfMarkedDone: done[t.key] ?? false });
      }
    }
    const closingAnswers = assignment.closingQuestions.map((q) => ({ key: q.key, answer: (closing[q.key] ?? '').trim() }));
    return { taskAnswers, closingAnswers };
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04 } } }}
      className="mt-8 space-y-4"
    >
      <motion.div variants={fadeUp} className="rounded-lg bg-surface-sunken p-4 text-sm leading-6 text-ink-muted ring-1 ring-border-subtle">
        {assignment.summary}
      </motion.div>

      {assignment.tasks.map((task, i) => (
        <motion.div key={task.key} variants={fadeUp}>
          <TaskCard
            index={i + 1}
            task={task}
            selectedOption={mcq[task.key]}
            onSelectOption={(idx) => setMcq((s) => ({ ...s, [task.key]: idx }))}
            textValue={text[task.key] ?? ''}
            onText={(v) => setText((s) => ({ ...s, [task.key]: v }))}
            doneValue={done[task.key] ?? false}
            onDone={(v) => setDone((s) => ({ ...s, [task.key]: v }))}
          />
        </motion.div>
      ))}

      <motion.div variants={fadeUp} className="rounded-lg bg-surface p-6 ring-1 ring-border">
        <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
          <ClipboardList className="size-4" /> A few final questions
        </h3>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          These help us tailor your roadmap. All required.
        </p>
        <div className="mt-4 space-y-4">
          {assignment.closingQuestions.map((q) => (
            <div key={q.key}>
              <label className="mb-1.5 block text-sm text-ink">{q.prompt}</label>
              <textarea
                value={closing[q.key] ?? ''}
                onChange={(e) => setClosing((s) => ({ ...s, [q.key]: e.target.value }))}
                rows={2}
                className="w-full rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink ring-1 ring-border-subtle outline-none transition focus:ring-border-strong"
                placeholder="Your answer…"
              />
            </div>
          ))}
        </div>
      </motion.div>

      {submit.error ? (
        <div className="text-sm text-accent-red">
          {submit.error instanceof ApiError ? submit.error.message : 'Could not submit your assignment'}
        </div>
      ) : null}

      <motion.div variants={fadeUp} className="flex items-center gap-3 pb-10">
        <button
          type="button"
          onClick={() => submit.mutate(buildSubmission())}
          disabled={!canSubmit}
          className="group flex h-12 items-center justify-center gap-2 rounded-md bg-surface-inverse px-6 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
        >
          {submit.isPending ? 'Submitting…' : 'Submit assignment'}
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </button>
        {!canSubmit && !submit.isPending ? (
          <span className="text-xs text-ink-faint">
            {!allMcqAnswered ? 'Answer all multiple-choice questions' : 'Answer the final questions'} to continue
          </span>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

const TYPE_LABEL: Record<AssignmentTaskView['type'], string> = {
  mcq: 'Multiple choice',
  practice: 'Practice task',
  short_answer: 'Short answer',
};

function TaskCard({
  index,
  task,
  selectedOption,
  onSelectOption,
  textValue,
  onText,
  doneValue,
  onDone,
}: {
  index: number;
  task: AssignmentTaskView;
  selectedOption: number | undefined;
  onSelectOption: (idx: number) => void;
  textValue: string;
  onText: (v: string) => void;
  doneValue: boolean;
  onDone: (v: boolean) => void;
}) {
  return (
    <div className="rounded-lg bg-surface p-6 ring-1 ring-border">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-inverse text-xs font-semibold text-ink-inverse">
            {index}
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">{task.title}</div>
            <div className="mt-0.5 text-xs text-ink-faint">{TYPE_LABEL[task.type]}</div>
          </div>
        </div>
      </div>

      <p className="mt-4 whitespace-pre-line text-sm leading-6 text-ink-muted">{task.prompt}</p>

      {task.type === 'mcq' && task.options ? (
        <div className="mt-4 space-y-2">
          {task.options.map((opt, idx) => {
            const active = selectedOption === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectOption(idx)}
                className={`flex w-full items-center gap-3 rounded-md px-4 py-3 text-left text-sm ring-1 transition ${
                  active
                    ? 'bg-surface-sunken text-ink ring-border-strong'
                    : 'bg-surface-sunken text-ink-muted ring-border-subtle hover:ring-border'
                }`}
              >
                <span
                  className={`grid size-4 shrink-0 place-items-center rounded-full ring-1 ${
                    active ? 'bg-surface-inverse ring-surface-inverse' : 'ring-border-strong'
                  }`}
                >
                  {active ? <span className="size-1.5 rounded-full bg-ink-inverse" /> : null}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      ) : task.type === 'practice' ? (
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={doneValue}
              onChange={(e) => onDone(e.target.checked)}
              className="size-4 rounded border-border-strong"
            />
            I completed this task
          </label>
          <textarea
            value={textValue}
            onChange={(e) => onText(e.target.value)}
            rows={2}
            className="w-full rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink ring-1 ring-border-subtle outline-none transition focus:ring-border-strong"
            placeholder="Optional: notes on what you did or where you got stuck…"
          />
        </div>
      ) : (
        <textarea
          value={textValue}
          onChange={(e) => onText(e.target.value)}
          rows={3}
          className="mt-4 w-full rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink ring-1 ring-border-subtle outline-none transition focus:ring-border-strong"
          placeholder="Your answer…"
        />
      )}
    </div>
  );
}
