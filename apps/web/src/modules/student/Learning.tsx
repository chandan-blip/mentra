import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  FolderGit2,
  Lightbulb,
  Loader2,
  Search,
  Sparkles,
  Trophy,
  Wand2,
} from 'lucide-react';
import type { LearningCategoryView, LearningTestSummary } from '@mentra/shared';
import { SkillTagInput } from '../../components/SkillTagInput.js';
import { ApiError } from '../../lib/api.js';
import { useCreateCustomQuiz, useLearningCategories } from '../../lib/learning.js';

/**
 * Learning — a two-pane test-series library.
 *
 * LEFT: every topic available to the student — their own AI-generated ladder categories plus
 * every shared "build your own" quiz other students have generated — searchable in place.
 *
 * RIGHT: build a custom quiz. Name a topic (or pick a popular one), set your experience, pick
 * the languages/tech to bias it, choose how many questions, and hit generate. The server
 * serves an existing shared quiz when the topic + level already matches, otherwise it asks the
 * AI to build one and caches it so the next student searching the same thing is served instantly.
 */

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

const POPULAR_TOPICS = [
  'System Design',
  'Data Structures & Algorithms',
  'React',
  'TypeScript',
  'SQL',
  'Docker & Kubernetes',
  'REST & GraphQL APIs',
  'Operating Systems',
  'Computer Networks',
  'Behavioral / HR',
];

const QUESTION_COUNTS = [10, 20, 30, 50, 75, 100];

function tierLabel(level: number): string {
  return level <= 3 ? 'Beginner' : level <= 7 ? 'Intermediate' : 'Advanced';
}

export function LearningPage() {
  const { data: categories, isLoading } = useLearningCategories();
  // Shared search: the builder's topic field IS the search that filters the left list.
  const [query, setQuery] = useState('');

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto w-full max-w-8xl space-y-6"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,400px)]">
        <motion.div variants={fadeUp} className="min-w-0">
          <TopicList categories={categories} isLoading={isLoading} query={query} />
        </motion.div>
        <motion.div variants={fadeUp} className="min-w-0 self-start lg:sticky lg:top-4 lg:h-fit">
          <CustomQuizBuilder categories={categories ?? []} query={query} setQuery={setQuery} />
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Left pane — existing topics                                        */
/* ------------------------------------------------------------------ */

function TopicList({
  categories,
  isLoading,
  query,
}: {
  categories: LearningCategoryView[] | undefined;
  isLoading: boolean;
  query: string;
}) {
  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    const all = categories ?? [];
    if (!q) return all;
    return all.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.skillTags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [categories, q]);

  return (
    <section className="flex h-full flex-col gap-4">
      {isLoading && !categories ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[68px] rounded-lg bg-surface-sunken ring-1 ring-border-subtle" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg bg-surface-sunken px-4 py-10 text-center text-sm text-ink-muted ring-1 ring-border-subtle">
          {q ? (
            <>No topics match “{query.trim()}”. Generate it on the right →</>
          ) : (
            <>Your test series are being prepared — check back in a moment.</>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((c) => (
            <TopicRow key={c.id} category={c} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Per-difficulty accent, shared with the (now bypassed) ladder page's color language. */
const DIFF: Record<'beginner' | 'intermediate' | 'advanced', { label: string; dot: string }> = {
  beginner: { label: 'Beginner', dot: 'bg-accent-green' },
  intermediate: { label: 'Intermediate', dot: 'bg-accent-amber' },
  advanced: { label: 'Advanced', dot: 'bg-accent-red' },
};

/**
 * A topic and its tests, inline. The difficulty rungs (Beginner/Intermediate/Advanced) are
 * shown as direct-open buttons — no intermediate ladder page — so a click goes straight into
 * the test. A single-test custom quiz renders one full-width start button.
 */
function TopicRow({ category: c }: { category: LearningCategoryView }) {
  const navigate = useNavigate();
  // Defensive defaults: benefit/projects are optional and absent on categories generated
  // before those fields existed (or when the API hasn't been redeployed yet). Fall back to
  // the skill tags (always present) so the card is never bare.
  const projects = c.projects ?? [];
  const skillTags = c.skillTags ?? [];
  const chips = projects.length ? projects.slice(0, 3) : skillTags.slice(0, 4);
  const chipsLabel = projects.length ? 'Build' : 'Skills';
  const tests = [...(c.tests ?? [])].sort((a, b) => a.order - b.order);
  const single = tests.length === 1;

  return (
    <div className="rounded-lg bg-surface px-4 py-3.5 ring-1 ring-border-subtle">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-ink">{c.title}</h3>
            {c.seriesCompleted ? <Trophy className="size-3.5 shrink-0 text-accent-green" /> : null}
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-ink-muted">{c.description}</p>
        </div>
        {c.isShared ? (
          <span className="shrink-0 rounded-full bg-accent-blue/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-blue">
            {c.experienceLevel !== null ? tierLabel(c.experienceLevel) : 'Custom'}
          </span>
        ) : null}
      </div>

      {/* What this helps you do. */}
      {c.benefit ? (
        <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-5 text-ink">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-accent-amber" />
          <span className="min-w-0">{c.benefit}</span>
        </p>
      ) : null}

      {/* Where it applies — example projects (falls back to skill tags before regeneration). */}
      {chips.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            <FolderGit2 className="size-3" /> {chipsLabel}
          </span>
          {chips.map((p) => (
            <span
              key={p}
              className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-muted ring-1 ring-border-subtle"
            >
              {p}
            </span>
          ))}
        </div>
      ) : null}

      {tests.length > 0 ? (
        <div className={`mt-3 ${single ? '' : 'grid grid-cols-3 gap-2'}`}>
          {tests.map((t) => (
            <TestButton key={t.id} test={t} single={single} onClick={() => navigate(`/learning/test/${t.id}`)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** One difficulty rung as a direct-open button — shows status and jumps into the test. */
function TestButton({
  test: t,
  single,
  onClick,
}: {
  test: LearningTestSummary;
  single: boolean;
  onClick: () => void;
}) {
  const d = DIFF[t.difficulty];
  const sub = t.passed
    ? 'Passed'
    : t.attempts
      ? `Best ${t.bestPercent}%`
      : single && t.totalQuestions
        ? `${t.totalQuestions} questions`
        : 'Not started';
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center justify-between gap-2 rounded-md bg-surface-sunken px-3 py-2 text-left ring-1 ring-border-subtle transition hover:ring-border-strong"
    >
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className={`size-1.5 shrink-0 rounded-full ${d.dot}`} />
          <span className="truncate text-xs font-semibold text-ink">{single ? 'Start quiz' : d.label}</span>
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-ink-faint">{sub}</span>
      </span>
      {t.passed ? (
        <Check className="size-3.5 shrink-0 text-accent-green" />
      ) : (
        <ArrowRight className="size-3.5 shrink-0 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Right pane — custom quiz builder                                   */
/* ------------------------------------------------------------------ */

/**
 * Modern experience slider (0–10 years). A styled track + filled range + draggable thumb, with
 * the real <input type="range"> laid transparently on top so keyboard + pointer + a11y still work.
 */
function ExperienceSlider({ value, onChange, max = 10 }: { value: number; onChange: (v: number) => void; max?: number }) {
  const pct = (value / max) * 100;
  return (
    <div className="relative h-5 select-none">
      {/* base track */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-surface-sunken ring-1 ring-border-subtle" />
      {/* filled range */}
      <div
        className="pointer-events-none absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-accent-blue/70 to-accent-blue"
        style={{ width: `${pct}%` }}
      />
      {/* thumb */}
      <div
        className="pointer-events-none absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-accent-blue bg-canvas shadow-[0_1px_4px_rgba(0,0,0,0.18)] transition-[left] duration-75"
        style={{ left: `${pct}%` }}
      />
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Years of experience"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}

function CustomQuizBuilder({
  categories,
  query,
  setQuery,
}: {
  categories: LearningCategoryView[];
  query: string;
  setQuery: (v: string) => void;
}) {
  const create = useCreateCustomQuiz();

  const [experience, setExperience] = useState(4);
  const [languages, setLanguages] = useState<string[]>([]);
  const [count, setCount] = useState(20);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const topic = query.trim();
  const q = topic.toLowerCase();

  // "Available" = the search already matches a topic in the list (own or shared). Same rule as
  // the left-list filter, so the two always agree.
  const hasMatch =
    q.length >= 2 &&
    categories.some(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.skillTags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  const canGenerate = q.length >= 2 && !hasMatch;

  function openConfirm() {
    if (!canGenerate) return;
    setError('');
    setConfirmOpen(true);
  }

  async function generate() {
    setError('');
    try {
      await create.mutateAsync({
        topic,
        experienceLevel: experience,
        languages,
        questionCount: count,
      });
      // The list query is invalidated by the mutation — the new topic appears on the left,
      // filtered by the current search. Close the dialog; no navigation.
      setConfirmOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not build your quiz. Try again.');
    }
  }

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl bg-surface ring-1 ring-border-subtle">
      <div className="border-b border-border-subtle px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="grid size-7 place-items-center rounded-md bg-accent-blue/10 text-accent-blue">
            <Wand2 className="size-4" />
          </span>
          Build your own quiz
        </h2>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          Search a topic — pick it from the list, or generate it if it’s new.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-6 px-5 py-5">
        {/* Topic — doubles as the search that filters the left list. */}
        <div>
          <label className="mb-2 block text-xs font-medium text-ink-muted">What do you want to learn?</label>
          <div className="flex items-center gap-2 rounded-lg bg-surface-sunken px-3.5 py-2 ring-1 ring-border-subtle transition focus-within:ring-border-strong">
            <Search className="size-4 shrink-0 text-ink-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={80}
              placeholder="Search or name a topic…"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
          </div>
          {q.length >= 2 ? (
            <p className="mt-1.5 text-[11px] text-ink-faint">
              {hasMatch ? 'Matches shown on the left — pick one to start.' : 'Not in the list yet — generate it below.'}
            </p>
          ) : null}
        </div>

        {/* Popular topics */}
        <div>
          <label className="mb-2 block text-xs font-medium text-ink-muted">Popular topics</label>
          <div className="flex flex-wrap gap-2">
            {POPULAR_TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setQuery(t)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                  topic.toLowerCase() === t.toLowerCase()
                    ? 'bg-surface-inverse text-ink-inverse ring-transparent'
                    : 'bg-surface-sunken text-ink-muted ring-border-subtle hover:text-ink hover:ring-border-strong'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Experience (years) */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <label className="text-xs font-medium text-ink-muted">Years of experience</label>
            <span className="text-xs font-semibold text-ink">
              {experience}
              {experience >= 10 ? '+' : ''} {experience === 1 ? 'yr' : 'yrs'}
            </span>
          </div>
          <ExperienceSlider value={experience} onChange={setExperience} />
          <div className="mt-2 flex justify-between text-[10px] tabular-nums text-ink-faint">
            <span>0</span>
            <span>5</span>
            <span>10+</span>
          </div>
        </div>

        {/* Languages & tech */}
        <div>
          <label className="mb-2 block text-xs font-medium text-ink-muted">Languages &amp; tech (optional)</label>
          <SkillTagInput value={languages} onChange={setLanguages} max={12} />
        </div>

        {/* Question count */}
        <div>
          <label className="mb-2 block text-xs font-medium text-ink-muted">Number of questions</label>
          <div className="flex flex-wrap gap-2">
            {QUESTION_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className={`min-w-[3rem] rounded-md px-3 py-2 text-sm font-semibold ring-1 transition ${
                  count === n
                    ? 'bg-surface-inverse text-ink-inverse ring-transparent'
                    : 'bg-surface-sunken text-ink ring-border-subtle hover:ring-border-strong'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generate */}
      <div className="border-t border-border-subtle px-5 py-4">
        <button
          type="button"
          onClick={openConfirm}
          disabled={!canGenerate}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-surface-inverse text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
        >
          <Sparkles className="size-4" />
          {q.length < 2 ? 'Search a topic' : hasMatch ? 'Already available' : 'Generate this quiz'}
        </button>
      </div>

      {confirmOpen ? (
        <ConfirmGenerateDialog
          topic={topic}
          experience={experience}
          languages={languages}
          count={count}
          pending={create.isPending}
          error={error}
          onCancel={() => setConfirmOpen(false)}
          onGenerate={generate}
        />
      ) : null}
    </section>
  );
}

/** Confirm-and-generate dialog shown when the searched topic isn't in the list yet. */
function ConfirmGenerateDialog({
  topic,
  experience,
  languages,
  count,
  pending,
  error,
  onCancel,
  onGenerate,
}: {
  topic: string;
  experience: number;
  languages: string[];
  count: number;
  pending: boolean;
  error: string;
  onCancel: () => void;
  onGenerate: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => !pending && onCancel()}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-surface p-5 shadow-card ring-1 ring-border-subtle"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="grid size-7 place-items-center rounded-md bg-accent-blue/10 text-accent-blue">
            <Wand2 className="size-4" />
          </span>
          Generate this quiz?
        </h3>
        <p className="mt-1.5 text-xs leading-5 text-ink-muted">
          No topic matches your search yet. AI will build it and add it to the list for everyone.
        </p>

        <div className="mt-3 rounded-lg bg-surface-sunken p-3 ring-1 ring-border-subtle">
          <div className="text-sm font-semibold text-ink">{topic}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-faint">
            <span>
              {experience}
              {experience >= 10 ? '+' : ''} {experience === 1 ? 'yr' : 'yrs'}
            </span>
            <span>{count} questions</span>
            {languages.length ? <span className="truncate">{languages.join(', ')}</span> : null}
          </div>
        </div>

        {error ? <p className="mt-2 text-xs text-accent-red">{error}</p> : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="h-10 flex-1 rounded-md text-sm font-medium text-ink-muted ring-1 ring-border-subtle transition hover:ring-border-strong disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={pending}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-surface-inverse text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Generate
              </>
            )}
          </button>
        </div>
        {pending ? (
          <p className="mt-2 text-center text-[11px] text-ink-faint">
            Building with AI — this can take a few seconds.
          </p>
        ) : null}
      </div>
    </div>
  );
}
