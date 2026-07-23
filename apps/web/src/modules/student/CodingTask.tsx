import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  ListChecks,
  Loader2,
  Play,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import type {
  CodingDifficulty,
  CodingLanguage,
  CodingQuestionDetail,
  CodingStatus,
  CodingSubmissionView,
  CodingTaskDetail,
} from '@mentra/shared';
import { CodeEditor } from '../../components/CodeEditor.js';
import { useCodingTask, useSubmitCoding } from '../../lib/coding.js';

/**
 * Coding solver — the split-pane workspace for ONE task.
 * LEFT: every question in the task (click to switch). MIDDLE: the selected question's
 * statement + sample cases. RIGHT: a VS Code (Monaco) editor with a language switcher and
 * Submit (runs the code against that question's test cases in the sandbox) + results.
 */

const DIFFICULTY_BADGE: Record<CodingDifficulty, string> = {
  beginner: 'bg-accent-green/10 text-accent-green ring-accent-green/20',
  intermediate: 'bg-accent-amber/10 text-accent-amber ring-accent-amber/20',
  advanced: 'bg-accent-red/10 text-accent-red ring-accent-red/20',
};

const LANGUAGE_LABEL: Record<CodingLanguage, string> = {
  javascript: 'JavaScript',
};

export function CodingTaskPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { data: task, isLoading, isError } = useCodingTask(taskId ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default the selected question to the first unsolved one (or the first) once loaded.
  useEffect(() => {
    if (!task || task.questions.length === 0) return;
    const stillValid = selectedId && task.questions.some((q) => q.id === selectedId);
    if (stillValid) return;
    const firstUnsolved = task.questions.find((q) => q.status !== 'passed');
    setSelectedId((firstUnsolved ?? task.questions[0]!).id);
  }, [task, selectedId]);

  if (isError) {
    return (
      <div className="mx-auto grid min-h-[50vh] max-w-md place-items-center text-center">
        <div>
          <h2 className="text-display-sm tracking-normal">Task not found</h2>
          <p className="mt-2 text-sm text-ink-muted">This coding task doesn’t exist or was removed.</p>
          <button
            type="button"
            onClick={() => navigate('/coding')}
            className="mt-6 h-10 rounded-md bg-surface-inverse px-5 text-sm font-semibold text-ink-inverse transition hover:bg-ink"
          >
            Back to tasks
          </button>
        </div>
      </div>
    );
  }

  const selected = task?.questions.find((q) => q.id === selectedId) ?? null;
  const solved = task?.questions.filter((q) => q.status === 'passed').length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/coding')}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
        >
          <ArrowLeft className="size-4" /> All tasks
        </button>
        {task ? (
          <>
            <span className="truncate text-sm font-medium text-ink">{task.title}</span>
            <span className={`rounded-sm px-2 py-0.5 text-xs capitalize ring-1 ${DIFFICULTY_BADGE[task.difficulty]}`}>
              {task.difficulty}
            </span>
            <span className="ml-auto text-xs text-ink-faint">
              {solved}/{task.questions.length} solved
            </span>
          </>
        ) : null}
      </div>

      <div className="grid gap-4 xl:h-[calc(100dvh-10rem)] xl:grid-cols-[240px_minmax(0,1fr)_minmax(0,1.15fr)]">
        {isLoading || !task ? (
          <div className="grid place-items-center rounded-lg bg-surface p-8 text-sm text-ink-faint ring-1 ring-border-subtle xl:col-span-3">
            Loading task…
          </div>
        ) : (
          <>
            <QuestionRail
              task={task}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            {selected ? (
              <>
                <ProblemPanel question={selected} />
                <Solver key={selected.id} taskId={task.id} question={selected} />
              </>
            ) : (
              <div className="grid place-items-center rounded-lg bg-surface p-8 text-sm text-ink-faint ring-1 ring-border-subtle xl:col-span-2">
                This task has no questions yet.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --- Left rail: the task's questions ---

function QuestionRail({
  task,
  selectedId,
  onSelect,
}: {
  task: CodingTaskDetail;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="flex max-h-56 flex-col overflow-hidden rounded-lg bg-surface ring-1 ring-border-subtle xl:max-h-none">
      <div className="flex items-center gap-1.5 border-b border-border-subtle px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
        <ListChecks className="size-3.5" /> Questions
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto p-2">
        {task.questions.map((q, i) => {
          const active = q.id === selectedId;
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onSelect(q.id)}
              className={`mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition ${
                active ? 'bg-surface-sunken text-ink ring-1 ring-border-subtle' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
              }`}
            >
              <StatusDot status={q.status} />
              <span className="shrink-0 text-xs text-ink-faint">{i + 1}.</span>
              <span className="line-clamp-1 flex-1">{q.title}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function StatusDot({ status }: { status: CodingStatus }) {
  if (status === 'passed') return <CheckCircle2 className="size-4 shrink-0 text-accent-green" />;
  if (status === 'attempted') return <Clock className="size-4 shrink-0 text-accent-amber" />;
  return <Circle className="size-4 shrink-0 text-ink-faint" />;
}

// --- Middle: problem statement + sample cases ---

function ProblemPanel({ question }: { question: CodingQuestionDetail }) {
  return (
    <section className="flex flex-col overflow-hidden rounded-lg bg-surface ring-1 ring-border-subtle">
      <div className="border-b border-border-subtle px-4 py-3">
        <h2 className="font-semibold text-ink">{question.title}</h2>
      </div>
      <div className="no-scrollbar flex-1 space-y-5 overflow-y-auto p-4">
        <div className="whitespace-pre-wrap text-sm leading-6 text-ink-muted">{question.description}</div>

        {question.sampleTestCases.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Examples</h3>
            {question.sampleTestCases.map((tc, i) => (
              <div key={i} className="rounded-md bg-surface-sunken p-3 ring-1 ring-border-subtle">
                <div className="mb-1 text-xs font-medium text-ink-faint">Example {i + 1}</div>
                <IoBlock label="Input" value={tc.input} />
                <IoBlock label="Expected output" value={tc.expectedOutput} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function IoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2 first:mt-0">
      <div className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</div>
      <pre className="mt-0.5 overflow-x-auto rounded bg-canvas px-2 py-1.5 font-mono text-xs text-ink ring-1 ring-border-subtle">
        {value || '(empty)'}
      </pre>
    </div>
  );
}

// --- Right: editor + submit + results (re-mounted per question via key) ---

function Solver({ taskId, question }: { taskId: string; question: CodingQuestionDetail }) {
  const [language, setLanguage] = useState<CodingLanguage>(
    question.lastSubmission?.language ?? question.languages[0]!,
  );
  const [code, setCode] = useState<string>(question.lastSubmission?.code ?? question.starterCode ?? '');
  const [result, setResult] = useState<CodingSubmissionView | null>(question.lastSubmission ?? null);
  const submit = useSubmitCoding(taskId, question.id);

  const onSubmit = () => {
    submit.mutate({ language, code }, { onSuccess: (r) => setResult(r) });
  };

  const resetToStarter = () => setCode(question.starterCode ?? '');

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg bg-surface ring-1 ring-border-subtle">
      <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as CodingLanguage)}
          className="h-8 rounded-md bg-surface-sunken px-2 text-sm text-ink ring-1 ring-border-subtle focus:outline-none focus:ring-border-strong"
        >
          {question.languages.map((l) => (
            <option key={l} value={l}>
              {LANGUAGE_LABEL[l]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={resetToStarter}
          title="Reset to starter code"
          className="flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
        >
          <RotateCcw className="size-3.5" /> Reset
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submit.isPending || !code.trim()}
          className="ml-auto flex h-8 items-center gap-1.5 rounded-md bg-surface-inverse px-3 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
        >
          {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-3.5" />}
          {submit.isPending ? 'Running…' : 'Run & Submit'}
        </button>
      </div>

      <div className="h-[52vh] min-h-0 xl:h-auto xl:flex-1">
        <CodeEditor value={code} onChange={setCode} language={language} height="100%" />
      </div>

      <ResultsPanel result={result} pending={submit.isPending} error={submit.error as Error | null} />
    </section>
  );
}

function ResultsPanel({
  result,
  pending,
  error,
}: {
  result: CodingSubmissionView | null;
  pending: boolean;
  error: Error | null;
}) {
  const summary = useMemo(() => {
    if (!result) return null;
    const passed = result.status === 'passed';
    return {
      passed,
      className: passed
        ? 'bg-accent-green/10 text-accent-green ring-accent-green/20'
        : result.status === 'error'
          ? 'bg-accent-amber/10 text-accent-amber ring-accent-amber/20'
          : 'bg-accent-red/10 text-accent-red ring-accent-red/20',
      label:
        result.status === 'passed'
          ? 'All tests passed'
          : result.status === 'error'
            ? 'Execution error'
            : 'Some tests failed',
    };
  }, [result]);

  return (
    <div className="no-scrollbar max-h-[34vh] shrink-0 overflow-y-auto border-t border-border-subtle p-3 xl:max-h-[38%]">
      {error ? (
        <div className="rounded-md bg-accent-red/10 px-3 py-2 text-sm text-accent-red ring-1 ring-accent-red/20">
          {error.message}
        </div>
      ) : pending && !result ? (
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 className="size-4 animate-spin" /> Running your code against the test cases…
        </div>
      ) : !result || !summary ? (
        <div className="text-sm text-ink-faint">Submit your solution to see results and an AI review here.</div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium ring-1 ${summary.className}`}>
              {summary.passed ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
              {summary.label}
            </span>
            <span className="text-sm text-ink-muted">
              {result.passedCount}/{result.totalCount} passed · {result.percent}%
            </span>
          </div>

          {result.results.length > 0 ? (
            <div className="space-y-2">
              {result.results.map((r) => (
                <div
                  key={r.index}
                  className={`rounded-md p-2.5 text-xs ring-1 ${
                    r.passed ? 'bg-surface-sunken ring-border-subtle' : 'bg-accent-red/5 ring-accent-red/20'
                  }`}
                >
                  <div className="mb-1 flex items-center gap-1.5 font-medium">
                    {r.passed ? (
                      <CheckCircle2 className="size-3.5 text-accent-green" />
                    ) : (
                      <XCircle className="size-3.5 text-accent-red" />
                    )}
                    <span className="text-ink">Test {r.index + 1}</span>
                    {r.hidden ? <span className="text-ink-faint">(hidden)</span> : null}
                  </div>
                  {!r.hidden ? (
                    <div className="grid gap-1.5 sm:grid-cols-3">
                      <MiniIo label="Input" value={r.input} />
                      <MiniIo label="Expected" value={r.expected} />
                      <MiniIo label="Got" value={r.actual} tone={r.passed ? undefined : 'bad'} />
                    </div>
                  ) : null}
                  {r.stderr ? (
                    <pre className="mt-1.5 overflow-x-auto rounded bg-canvas px-2 py-1 font-mono text-[11px] text-accent-red ring-1 ring-accent-red/20">
                      {r.stderr}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {result.aiFeedback ? (
            <div className="rounded-md bg-surface-sunken p-3 ring-1 ring-border-subtle">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">Mentor review</div>
              <div className="whitespace-pre-wrap text-sm leading-6 text-ink-muted">{result.aiFeedback}</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MiniIo({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</div>
      <pre
        className={`mt-0.5 max-h-24 overflow-auto rounded bg-canvas px-1.5 py-1 font-mono text-[11px] ring-1 ${
          tone === 'bad' ? 'text-accent-red ring-accent-red/20' : 'text-ink ring-border-subtle'
        }`}
      >
        {value || '(empty)'}
      </pre>
    </div>
  );
}
