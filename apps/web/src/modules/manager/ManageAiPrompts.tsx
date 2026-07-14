import { useMemo, useState, type ReactNode } from 'react';
import type { AiPromptView } from '@mentra/shared';
import { Loader2, RotateCcw, Sparkles, Thermometer, Wand2, X } from 'lucide-react';
import { useAiPrompts, useResetAiPrompt, useSaveAiPrompt } from '../../lib/aiPrompts.js';

/**
 * AI-prompt tuning ('manage-ai-prompts' module): a role-gated console over every AI
 * feature's system prompt + temperature. Prompts are grouped by feature; a manager can
 * edit the system text and sampling temperature or reset a prompt to its code default.
 * Required template tokens (e.g. {MIN}) are surfaced so an edit can't drop them.
 */
export function ManageAiPromptsPage() {
  const prompts = useAiPrompts();
  const [editing, setEditing] = useState<AiPromptView | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, AiPromptView[]>();
    for (const p of prompts.data ?? []) {
      const list = map.get(p.group) ?? [];
      list.push(p);
      map.set(p.group, list);
    }
    return [...map.entries()];
  }, [prompts.data]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-1 flex items-center gap-2">
        <Wand2 className="size-5 text-ink-muted" />
        <h1 className="text-display-sm font-semibold text-ink">AI Prompts</h1>
      </div>
      <p className="mb-5 text-sm text-ink-faint">
        Tune the system prompt and temperature behind every AI feature. Changes take effect on the next
        generation; reset any prompt to restore its built-in default.
      </p>

      {prompts.isLoading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-ink-faint">
          <Loader2 className="size-4 animate-spin" /> Loading prompts…
        </div>
      ) : prompts.isError ? (
        <div className="rounded-md bg-accent-red/10 px-3 py-2 text-sm text-accent-red ring-1 ring-accent-red/20">
          Couldn’t load prompts. You may not have access to this module.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(([group, items]) => (
            <section key={group}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{group}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((p) => (
                  <PromptCard key={p.key} prompt={p} onEdit={() => setEditing(p)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {editing ? <PromptEditor prompt={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function PromptCard({ prompt, onEdit }: { prompt: AiPromptView; onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex flex-col items-start gap-2 rounded-lg bg-surface p-4 text-left ring-1 ring-border transition hover:ring-border-strong"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="font-semibold text-ink">{prompt.label}</span>
        {prompt.isCustomized ? (
          <span className="shrink-0 rounded-sm bg-accent-blue/10 px-1.5 py-0.5 text-[11px] font-medium text-accent-blue">
            Customized
          </span>
        ) : (
          <span className="shrink-0 rounded-sm bg-surface-sunken px-1.5 py-0.5 text-[11px] font-medium text-ink-faint">
            Default
          </span>
        )}
      </div>
      <p className="line-clamp-2 text-sm text-ink-muted">{prompt.description}</p>
      <div className="mt-1 flex items-center gap-3 text-xs text-ink-faint">
        <span className="flex items-center gap-1">
          <Thermometer className="size-3.5" /> {prompt.temperature.toFixed(2)}
        </span>
        {prompt.variables.length > 0 ? (
          <span className="flex items-center gap-1">
            {prompt.variables.map((v) => (
              <code key={v} className="rounded-sm bg-surface-sunken px-1 py-0.5 font-mono text-[11px] text-ink-muted">
                {v}
              </code>
            ))}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function PromptEditor({ prompt, onClose }: { prompt: AiPromptView; onClose: () => void }) {
  const [system, setSystem] = useState(prompt.system);
  const [temperature, setTemperature] = useState(prompt.temperature);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveAiPrompt();
  const reset = useResetAiPrompt();

  const missing = prompt.variables.filter((v) => !system.includes(v));
  const dirty = system !== prompt.system || temperature !== prompt.temperature;
  const busy = save.isPending || reset.isPending;

  const submit = () => {
    setError(null);
    if (missing.length > 0) {
      setError(`Keep the required token${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);
      return;
    }
    save.mutate(
      { key: prompt.key, systemPrompt: system.trim(), temperature },
      { onSuccess: onClose, onError: (e) => setError((e as Error).message) },
    );
  };

  const onReset = () => {
    if (!window.confirm(`Reset “${prompt.label}” to its built-in default?`)) return;
    setError(null);
    reset.mutate(prompt.key, { onSuccess: onClose, onError: (e) => setError((e as Error).message) });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas-deep/72 px-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-surface p-5 shadow-card ring-1 ring-border"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">{prompt.label}</h2>
            <p className="mt-0.5 text-sm text-ink-faint">{prompt.description}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-muted transition hover:bg-surface-sunken">
            <X className="size-5" />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-md bg-accent-red/10 px-3 py-2 text-sm text-accent-red ring-1 ring-accent-red/20">
            {error}
          </div>
        ) : null}

        {prompt.variables.length > 0 ? (
          <div className="mb-3 rounded-md bg-surface-sunken px-3 py-2 text-xs text-ink-muted">
            This prompt uses template tokens that are filled in at runtime — keep them in the text:{' '}
            {prompt.variables.map((v) => (
              <code
                key={v}
                className={`mr-1 rounded-sm px-1 py-0.5 font-mono text-[11px] ${
                  missing.includes(v) ? 'bg-accent-red/15 text-accent-red' : 'bg-surface text-ink-muted'
                }`}
              >
                {v}
              </code>
            ))}
          </div>
        ) : null}

        <Field label="System prompt">
          <textarea
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            spellCheck={false}
            className="auth-input-plain h-[50vh] w-full resize-y font-mono text-[13px] leading-relaxed"
          />
        </Field>

        <Field label={`Temperature — ${temperature.toFixed(2)}`}>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="flex-1 accent-accent-blue"
            />
            <input
              type="number"
              min={0}
              max={2}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(Math.min(2, Math.max(0, Number(e.target.value))))}
              className="auth-input-plain h-9 w-20"
            />
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            Lower = more deterministic and consistent; higher = more varied and creative. Default{' '}
            {prompt.defaultTemperature.toFixed(2)}.
          </p>
        </Field>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={busy || !prompt.isCustomized}
            className="flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-ink-muted transition hover:bg-surface-sunken disabled:opacity-40"
            title={prompt.isCustomized ? 'Reset to built-in default' : 'Already the default'}
          >
            {reset.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            Reset to default
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-md px-3 text-sm text-ink-muted transition hover:bg-surface-sunken"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !dirty || !system.trim() || missing.length > 0}
              className="flex h-9 items-center gap-1.5 rounded-md bg-surface-inverse px-3 text-sm font-semibold text-ink-inverse transition hover:bg-ink disabled:opacity-50"
            >
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
