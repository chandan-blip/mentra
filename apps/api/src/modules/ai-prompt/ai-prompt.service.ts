import type { AiPromptView, UpdateAiPromptInput } from '@mentra/shared';
import { AI_PROMPT_REGISTRY, getPromptDef } from './ai-prompt.registry.js';
import { AiPromptError } from './ai-prompt.errors.js';
import * as repo from './ai-prompt.repository.js';

/**
 * Resolves the effective system prompt + temperature for each AI feature by merging a
 * manager's stored override (if any) over the code-owned registry default, and powers
 * the manager tuning UI (list / update / reset).
 *
 * Overrides are cached in-process so the hot path (every AI generation calls
 * `getPromptConfig`) doesn't hit the DB each time; the cache is invalidated on any
 * write and expires after a short TTL as a safety net.
 */

// Access module key — mirrors how 'manage-videos' gates the video-admin surface.
export const AI_PROMPT_MODULE = 'manage-ai-prompts';

type CachedOverride = { systemPrompt: string; temperature: number | null };

let cache: Map<string, CachedOverride> | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 60_000;

async function overrides(): Promise<Map<string, CachedOverride>> {
  if (cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;
  const rows = await repo.findAllOverrides();
  cache = new Map(
    [...rows.entries()].map(([key, r]) => [key, { systemPrompt: r.systemPrompt, temperature: r.temperature }]),
  );
  cacheAt = Date.now();
  return cache;
}

function invalidate(): void {
  cache = null;
  cacheAt = 0;
}

/**
 * The effective prompt config for a feature. Callers use this instead of an inline
 * system string, then apply their own `{TOKEN}` interpolation on `system`.
 */
export async function getPromptConfig(key: string): Promise<{ system: string; temperature: number }> {
  const def = getPromptDef(key);
  const override = (await overrides()).get(key);
  return {
    system: override?.systemPrompt ?? def.defaultSystem,
    temperature: override?.temperature ?? def.defaultTemperature,
  };
}

/** All tunable prompts (registry defaults merged with any stored overrides) for the UI. */
export async function listPrompts(): Promise<AiPromptView[]> {
  const rows = await repo.findAllOverrides();
  return AI_PROMPT_REGISTRY.map((def) => {
    const row = rows.get(def.key);
    return {
      key: def.key,
      label: def.label,
      group: def.group,
      description: def.description,
      variables: def.variables,
      system: row?.systemPrompt ?? def.defaultSystem,
      temperature: row?.temperature ?? def.defaultTemperature,
      defaultSystem: def.defaultSystem,
      defaultTemperature: def.defaultTemperature,
      isCustomized: !!row,
      updatedAt: row ? row.updatedAt.toISOString() : null,
      updatedBy: row?.updatedBy ?? null,
    };
  });
}

/** Save (or replace) a manager override for one prompt. */
export async function updatePrompt(
  key: string,
  input: UpdateAiPromptInput,
  editedBy: string | null,
): Promise<AiPromptView> {
  const def = AI_PROMPT_REGISTRY.find((d) => d.key === key);
  if (!def) throw new AiPromptError('PROMPT_NOT_FOUND', 'Unknown prompt', 404);
  // Guard the required template tokens so a save can't silently break interpolation.
  const missing = def.variables.filter((v) => !input.systemPrompt.includes(v));
  if (missing.length > 0) {
    throw new AiPromptError(
      'MISSING_TOKENS',
      `Keep the required template token${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`,
      400,
    );
  }
  await repo.upsertOverride({
    key,
    systemPrompt: input.systemPrompt,
    temperature: input.temperature,
    updatedBy: editedBy,
  });
  invalidate();
  return findOne(key);
}

/** Drop the override so the prompt reverts to its code default. */
export async function resetPrompt(key: string): Promise<AiPromptView> {
  if (!AI_PROMPT_REGISTRY.some((d) => d.key === key))
    throw new AiPromptError('PROMPT_NOT_FOUND', 'Unknown prompt', 404);
  await repo.deleteOverride(key);
  invalidate();
  return findOne(key);
}

async function findOne(key: string): Promise<AiPromptView> {
  const all = await listPrompts();
  const found = all.find((p) => p.key === key);
  if (!found) throw new AiPromptError('PROMPT_NOT_FOUND', 'Unknown prompt', 404);
  return found;
}
