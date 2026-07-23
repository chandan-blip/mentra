import { useState, type ReactNode } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Eye,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import type {
  CodingDifficulty,
  CodingLanguage,
  CodingQuestionInput,
  CodingSubmissionAdminView,
  CodingTaskAdminView,
  CodingTestCaseView,
  CreateCodingTaskInput,
} from '@mentra/shared';
import { Switch } from '../../components/Switch.js';
import {
  useAdminCodingTasks,
  useCodingTaskSubmissions,
  useCreateCodingTask,
  useDeleteCodingTask,
  useUpdateCodingTask,
} from '../../lib/coding.js';

const ALL_LANGUAGES: CodingLanguage[] = ['javascript'];
const DIFFICULTIES: CodingDifficulty[] = ['beginner', 'intermediate', 'advanced'];

const LANGUAGE_LABEL: Record<CodingLanguage, string> = {
  javascript: 'JavaScript',
};

const DIFFICULTY_BADGE: Record<CodingDifficulty, string> = {
  beginner: 'bg-accent-green/10 text-accent-green ring-accent-green/20',
  intermediate: 'bg-accent-amber/10 text-accent-amber ring-accent-amber/20',
  advanced: 'bg-accent-red/10 text-accent-red ring-accent-red/20',
};

/**
 * Coding Tasks ('coding-tasks' module): the manager surface. Author tasks — each a set of
 * questions (problem + allowed languages + stdin/stdout test cases) — toggle visibility, and
 * drill into a task's student submissions (auto-graded + AI-reviewed).
 */
export function ManageCodingTasksPage() {
  const { data: tasks, isLoading } = useAdminCodingTasks();
  const [editing, setEditing] = useState<CodingTaskAdminView | null>(null);
  const [creating, setCreating] = useState(false);
  const [subsFor, setSubsFor] = useState<CodingTaskAdminView | null>(null);
  const del = useDeleteCodingTask();
  const setVisible = useUpdateCodingTask();

  const rows = tasks ?? [];

  const onDelete = (t: CodingTaskAdminView) => {
    if (!window.confirm(`Delete “${t.title}”? This removes the task, its questions and all submissions.`)) return;
    del.mutate(t.id);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-1 flex items-center gap-2">
        <Code2 className="size-5 text-ink-muted" />
        <h1 className="text-display-sm font-semibold text-ink">Coding Tasks</h1>
      </div>
      <p className="mb-5 text-sm text-ink-faint">
        Create tasks with multiple questions and test cases, control what students see, and review submissions.
      </p>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs text-ink-faint">{rows.length} tasks</span>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-9 items-center gap-1.5 rounded-md bg-surface-inverse px-3 text-sm font-semibold text-ink-inverse transition hover:bg-ink"
        >
          <Plus className="size-4" /> New task
        </button>
      </div>

      <div className="overflow-x-auto rounded-md ring-1 ring-border-subtle">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface-sunken text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Task</th>
              <th className="px-3 py-2 text-left font-medium">Difficulty</th>
              <th className="px-3 py-2 text-center font-medium">Questions</th>
              <th className="px-3 py-2 text-center font-medium">Visible</th>
              <th className="px-3 py-2 text-center font-medium">Submissions</th>
              <th className="px-3 py-2 text-center font-medium">Students</th>
              <th className="px-3 py-2 text-center font-medium">Completed</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t border-border-subtle">
                <td className="px-3 py-2">
                  <span className="line-clamp-1 max-w-[20rem] font-medium text-ink">{t.title}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-sm px-2 py-0.5 text-xs capitalize ring-1 ${DIFFICULTY_BADGE[t.difficulty]}`}>
                    {t.difficulty}
                  </span>
                </td>
                <td className="px-3 py-2 text-center text-ink-muted">{t.questions.length}</td>
                <td className="px-3 py-2 text-center">
                  <Switch
                    checked={t.visible}
                    disabled={setVisible.isPending}
                    onChange={(next) => setVisible.mutate({ id: t.id, patch: { visible: next } })}
                    aria-label={`Toggle ${t.title} visible`}
                  />
                </td>
                <td className="px-3 py-2 text-center text-ink-muted">{t.stats.submissions}</td>
                <td className="px-3 py-2 text-center text-ink-muted">{t.stats.students}</td>
                <td className="px-3 py-2 text-center text-ink-muted">{t.stats.solved}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setSubsFor(t)}
                      className="rounded-md p-1.5 text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
                      aria-label={`Submissions for ${t.title}`}
                      title="View submissions"
                    >
                      <ListChecks className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(t)}
                      className="rounded-md p-1.5 text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
                      aria-label={`Edit ${t.title}`}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(t)}
                      disabled={del.isPending}
                      className="rounded-md p-1.5 text-ink-muted transition hover:bg-accent-red/10 hover:text-accent-red disabled:opacity-50"
                      aria-label={`Delete ${t.title}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {isLoading ? (
          <div className="p-6 text-center text-sm text-ink-faint">Loading tasks…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-ink-faint">No coding tasks yet. Create your first one.</div>
        ) : null}
      </div>

      {creating ? <TaskModal onClose={() => setCreating(false)} /> : null}
      {editing ? <TaskModal task={editing} onClose={() => setEditing(null)} /> : null}
      {subsFor ? <SubmissionsModal task={subsFor} onClose={() => setSubsFor(null)} /> : null}
    </div>
  );
}

// --- Create / edit form ---

const BLANK_CASE: CodingTestCaseView = { input: '', expectedOutput: '', hidden: false };
const blankQuestion = (): CodingQuestionInput => ({
  title: '',
  description: '',
  languages: ['javascript'],
  // Starter documents the JS I/O contract: read via input/readLine(), write via console.log().
  starterCode: [
    '// Read input with `readLine()` / `readInt()` (or the whole `input` string).',
    '// Print your answer with console.log(...).',
    'const name = readLine();',
    'console.log(`Hello, ${name}!`);',
  ].join('\n'),
  testCases: [{ ...BLANK_CASE }],
});

function TaskModal({ task, onClose }: { task?: CodingTaskAdminView; onClose: () => void }) {
  const isEdit = Boolean(task);
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [difficulty, setDifficulty] = useState<CodingDifficulty>(task?.difficulty ?? 'beginner');
  const [visible, setVisible] = useState(task?.visible ?? true);
  const [questions, setQuestions] = useState<CodingQuestionInput[]>(
    task?.questions.length
      ? task.questions.map((q) => ({
          title: q.title,
          description: q.description,
          languages: q.languages,
          starterCode: q.starterCode,
          testCases: q.testCases,
        }))
      : [blankQuestion()],
  );
  const [openIdx, setOpenIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const create = useCreateCodingTask();
  const update = useUpdateCodingTask();
  const pending = create.isPending || update.isPending;

  const setQuestion = (i: number, patch: Partial<CodingQuestionInput>) =>
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  const addQuestion = () => {
    setQuestions((prev) => [...prev, blankQuestion()]);
    setOpenIdx(questions.length);
  };

  const removeQuestion = (i: number) => {
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
    setOpenIdx((o) => (o >= i ? Math.max(0, o - 1) : o));
  };

  const questionValid = (q: CodingQuestionInput) =>
    q.title.trim().length > 0 &&
    q.description.trim().length > 0 &&
    q.languages.length > 0 &&
    q.testCases.length > 0 &&
    q.testCases.every((c) => c.expectedOutput.trim().length > 0 || c.input.trim().length > 0);

  const valid = title.trim().length > 0 && questions.length > 0 && questions.every(questionValid);

  const submit = () => {
    setError(null);
    const payload: CreateCodingTaskInput = { title: title.trim(), description: description.trim(), difficulty, visible, questions };
    const onErr = (e: unknown) => setError((e as Error).message);
    if (isEdit && task) {
      update.mutate({ id: task.id, patch: payload }, { onSuccess: onClose, onError: onErr });
    } else {
      create.mutate(payload, { onSuccess: onClose, onError: onErr });
    }
  };

  return (
    <Modal title={isEdit ? 'Edit coding task' : 'New coding task'} onClose={onClose}>
      {error ? (
        <div className="mb-3 rounded-md bg-accent-red/10 px-3 py-2 text-sm text-accent-red ring-1 ring-accent-red/20">
          {error}
        </div>
      ) : null}

      <Field label="Task title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} className="auth-input-plain h-9 w-full" placeholder="e.g. Array Warm-ups" />
      </Field>

      <Field label="Overview (optional)">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="auth-input-plain w-full resize-y py-2 text-sm"
          placeholder="Short intro shown above the question list."
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Difficulty">
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as CodingDifficulty)} className="auth-input-plain h-9 w-full capitalize">
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d} className="capitalize">
                {d}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Visible to students">
          <div className="flex h-9 items-center">
            <Switch checked={visible} onChange={setVisible} aria-label="Visible to students" />
            <span className="ml-2 text-sm text-ink-muted">{visible ? 'Shown' : 'Hidden'}</span>
          </div>
        </Field>
      </div>

      <div className="mb-2 mt-4 flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">Questions ({questions.length})</span>
        <button
          type="button"
          onClick={addQuestion}
          className="flex items-center gap-1 rounded-md bg-surface-sunken px-2 py-1 text-xs font-medium text-ink ring-1 ring-border-subtle transition hover:ring-border-strong"
        >
          <Plus className="size-3.5" /> Add question
        </button>
      </div>

      <div className="space-y-2">
        {questions.map((q, i) => (
          <QuestionCard
            key={i}
            index={i}
            question={q}
            open={openIdx === i}
            valid={questionValid(q)}
            onToggle={() => setOpenIdx((o) => (o === i ? -1 : i))}
            onChange={(patch) => setQuestion(i, patch)}
            onRemove={questions.length > 1 ? () => removeQuestion(i) : undefined}
          />
        ))}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-9 rounded-md px-3 text-sm text-ink-muted transition hover:bg-surface-sunken">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !valid}
          className="flex h-9 items-center gap-1.5 rounded-md bg-surface-inverse px-3 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null} {isEdit ? 'Save changes' : 'Create task'}
        </button>
      </div>
    </Modal>
  );
}

function QuestionCard({
  index,
  question,
  open,
  valid,
  onToggle,
  onChange,
  onRemove,
}: {
  index: number;
  question: CodingQuestionInput;
  open: boolean;
  valid: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<CodingQuestionInput>) => void;
  onRemove?: () => void;
}) {
  const toggleLanguage = (l: CodingLanguage) =>
    onChange({
      languages: question.languages.includes(l)
        ? question.languages.filter((x) => x !== l)
        : [...question.languages, l],
    });

  const setCase = (i: number, patch: Partial<CodingTestCaseView>) =>
    onChange({ testCases: question.testCases.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });

  return (
    <div className="rounded-md ring-1 ring-border-subtle">
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {open ? <ChevronDown className="size-4 text-ink-faint" /> : <ChevronRight className="size-4 text-ink-faint" />}
          <span className="shrink-0 text-xs font-medium text-ink-faint">Q{index + 1}</span>
          <span className="line-clamp-1 flex-1 text-sm font-medium text-ink">{question.title || 'Untitled question'}</span>
          {!valid ? <span className="shrink-0 text-[11px] text-accent-amber">incomplete</span> : null}
        </button>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-ink-muted transition hover:bg-accent-red/10 hover:text-accent-red"
            aria-label={`Remove question ${index + 1}`}
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="space-y-3 border-t border-border-subtle p-3">
          <Field label="Question title">
            <input value={question.title} onChange={(e) => onChange({ title: e.target.value })} maxLength={160} className="auth-input-plain h-9 w-full" placeholder="e.g. Sort an array" />
          </Field>

          <Field label="Allowed languages">
            <div className="flex flex-wrap gap-1.5">
              {ALL_LANGUAGES.map((l) => {
                const on = question.languages.includes(l);
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggleLanguage(l)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ring-1 transition ${
                      on
                        ? 'bg-surface-inverse text-ink-inverse ring-transparent'
                        : 'bg-surface-sunken text-ink-muted ring-border-subtle hover:ring-border-strong'
                    }`}
                  >
                    {LANGUAGE_LABEL[l]}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Problem statement">
            <textarea
              value={question.description}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={4}
              className="auth-input-plain w-full resize-y py-2 text-sm"
              placeholder="Describe the problem. Explain the input (stdin) and the exact expected output (stdout)."
            />
          </Field>

          <Field label="Starter code (optional)">
            <textarea
              value={question.starterCode}
              onChange={(e) => onChange({ starterCode: e.target.value })}
              rows={3}
              className="auth-input-plain w-full resize-y py-2 font-mono text-[13px]"
              placeholder="# Boilerplate students start from"
            />
          </Field>

          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted">
              Test cases <span className="text-ink-faint">— Input on stdin; trimmed stdout must equal Expected</span>
            </span>
            <button
              type="button"
              onClick={() => onChange({ testCases: [...question.testCases, { ...BLANK_CASE }] })}
              className="flex items-center gap-1 rounded-md bg-surface-sunken px-2 py-1 text-xs font-medium text-ink ring-1 ring-border-subtle transition hover:ring-border-strong"
            >
              <Plus className="size-3.5" /> Add case
            </button>
          </div>

          <div className="space-y-2">
            {question.testCases.map((c, ci) => (
              <div key={ci} className="rounded-md bg-surface-sunken p-2.5 ring-1 ring-border-subtle">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-ink-muted">Case {ci + 1}</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                      <input type="checkbox" checked={c.hidden} onChange={(e) => setCase(ci, { hidden: e.target.checked })} />
                      Hidden
                    </label>
                    {question.testCases.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => onChange({ testCases: question.testCases.filter((_, idx) => idx !== ci) })}
                        className="rounded p-1 text-ink-muted transition hover:bg-accent-red/10 hover:text-accent-red"
                        aria-label={`Remove case ${ci + 1}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 text-[11px] uppercase tracking-wide text-ink-faint">Input (stdin)</div>
                    <textarea value={c.input} onChange={(e) => setCase(ci, { input: e.target.value })} rows={3} className="auth-input-plain w-full resize-y py-1.5 font-mono text-xs" />
                  </div>
                  <div>
                    <div className="mb-1 text-[11px] uppercase tracking-wide text-ink-faint">Expected output</div>
                    <textarea value={c.expectedOutput} onChange={(e) => setCase(ci, { expectedOutput: e.target.value })} rows={3} className="auth-input-plain w-full resize-y py-1.5 font-mono text-xs" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// --- Submissions drill-in ---

function SubmissionsModal({ task, onClose }: { task: CodingTaskAdminView; onClose: () => void }) {
  const { data: subs, isLoading } = useCodingTaskSubmissions(task.id);
  const [open, setOpen] = useState<string | null>(null);
  const rows = subs ?? [];

  return (
    <Modal title={`Submissions — ${task.title}`} onClose={onClose}>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-ink-muted">
        <span className="flex items-center gap-1"><ListChecks className="size-3.5" /> {task.stats.submissions} submissions</span>
        <span className="flex items-center gap-1"><Users className="size-3.5" /> {task.stats.students} students</span>
        <span className="flex items-center gap-1"><CheckCircle2 className="size-3.5 text-accent-green" /> {task.stats.solved} completed</span>
      </div>

      {isLoading ? (
        <div className="p-6 text-center text-sm text-ink-faint">Loading submissions…</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-ink-faint">No submissions yet.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((s) => (
            <div key={s.id} className="rounded-md ring-1 ring-border-subtle">
              <button
                type="button"
                onClick={() => setOpen((o) => (o === s.id ? null : s.id))}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
              >
                {s.status === 'passed' ? (
                  <CheckCircle2 className="size-4 shrink-0 text-accent-green" />
                ) : (
                  <XCircle className="size-4 shrink-0 text-accent-red" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-sm font-medium text-ink">
                    {s.studentName ?? s.studentEmail ?? 'Student'} <span className="text-ink-faint">·</span>{' '}
                    <span className="text-ink-muted">{s.questionTitle}</span>
                  </div>
                  <div className="text-xs text-ink-faint">
                    {LANGUAGE_LABEL[s.language]} · {s.passedCount}/{s.totalCount} passed · {s.percent}% ·{' '}
                    {new Date(s.createdAt).toLocaleString()}
                  </div>
                </div>
                <span
                  className={`rounded-sm px-2 py-0.5 text-xs ring-1 ${
                    s.status === 'passed'
                      ? 'bg-accent-green/10 text-accent-green ring-accent-green/20'
                      : s.status === 'error'
                        ? 'bg-accent-amber/10 text-accent-amber ring-accent-amber/20'
                        : 'bg-accent-red/10 text-accent-red ring-accent-red/20'
                  }`}
                >
                  {s.status === 'passed' ? 'Correct' : s.status === 'error' ? 'Error' : 'Wrong'}
                </span>
              </button>
              {open === s.id ? <SubmissionDetail submission={s} /> : null}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function SubmissionDetail({ submission: s }: { submission: CodingSubmissionAdminView }) {
  return (
    <div className="space-y-3 border-t border-border-subtle p-3">
      <div>
        <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          <Eye className="size-3.5" /> Code
        </div>
        <pre className="max-h-64 overflow-auto rounded-md bg-canvas px-3 py-2 font-mono text-xs text-ink ring-1 ring-border-subtle">
          {s.code}
        </pre>
      </div>
      {s.aiFeedback ? (
        <div className="rounded-md bg-surface-sunken p-3 ring-1 ring-border-subtle">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">AI review</div>
          <div className="whitespace-pre-wrap text-sm leading-6 text-ink-muted">{s.aiFeedback}</div>
        </div>
      ) : null}
    </div>
  );
}

// --- Shared modal + field (mirrors ManageVideos) ---

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas-deep/72 px-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-surface p-5 shadow-card ring-1 ring-border"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-ink-muted transition hover:bg-surface-sunken">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
