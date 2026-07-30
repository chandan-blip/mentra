import { getBoolSetting, getJsonSetting, setBoolSetting, setJsonSetting } from '../../core/settings.js';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { SmmError } from './smm.errors.js';
import * as repo from './smm.repository.js';
import type { SmmQueueRow } from './smm.repository.js';

/**
 * SMM panel config + order placement.
 *
 * Config lives in `AppSetting` (not env) because an operator changes service ids and
 * quantities routinely — a redeploy per tweak would be absurd. The panel API key is the
 * one credential here that isn't in .env; it is write-only over the API (never returned
 * to the browser, see redactedConfig()).
 */
const PANEL_KEY = 'smm_panel_config';
const WEBHOOK_ENABLED_KEY = 'smm_webhook_enabled';

export type SmmPanelConfig = {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  viewsEnabled: boolean;
  viewsServiceId: string;
  viewsQuantity: number;
  reactionsEnabled: boolean;
  reactionsServiceId: string;
  reactionsQuantity: number;
};

const DEFAULT_CONFIG: SmmPanelConfig = {
  enabled: false,
  apiUrl: '',
  apiKey: '',
  viewsEnabled: true,
  viewsServiceId: '',
  viewsQuantity: 1000,
  reactionsEnabled: true,
  reactionsServiceId: '',
  reactionsQuantity: 100,
};

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_PANEL_ATTEMPTS = 2;

/** Exactly what is persisted — no env fallback. Used when writing, so a save can't bake
 *  the env values into the DB and make a later env change look ignored. */
function readStored(): Promise<SmmPanelConfig> {
  return getJsonSetting<SmmPanelConfig>(PANEL_KEY, DEFAULT_CONFIG);
}

/**
 * Effective config: stored values win, env fills the gaps. This lets credentials ship in
 * `.env` (so the panel works before anyone opens the admin UI) while still letting an
 * admin override them at runtime without a redeploy.
 */
export async function getConfig(): Promise<SmmPanelConfig> {
  const stored = await readStored();
  return {
    ...stored,
    apiUrl: stored.apiUrl || env.SMM_API_URL,
    apiKey: stored.apiKey || env.SMM_API_KEY,
  };
}

/** What the admin UI is allowed to see: everything except the panel API key itself. */
export async function getRedactedConfig(): Promise<Omit<SmmPanelConfig, 'apiKey'> & { apiKeySet: boolean }> {
  const { apiKey, ...rest } = await getConfig();
  return { ...rest, apiKeySet: Boolean(apiKey) };
}

export async function saveConfig(input: Partial<SmmPanelConfig>): Promise<void> {
  const current = await readStored();
  const merged: SmmPanelConfig = {
    ...current,
    ...input,
    enabled: Boolean(input.enabled ?? current.enabled),
    viewsEnabled: Boolean(input.viewsEnabled ?? current.viewsEnabled),
    reactionsEnabled: Boolean(input.reactionsEnabled ?? current.reactionsEnabled),
    viewsQuantity: Math.max(0, Number(input.viewsQuantity ?? current.viewsQuantity) || 0),
    reactionsQuantity: Math.max(0, Number(input.reactionsQuantity ?? current.reactionsQuantity) || 0),
    // An omitted or blank apiKey keeps the stored one — the UI never receives it back,
    // so submitting the form must not wipe the credential.
    apiKey: input.apiKey ? input.apiKey.trim() : current.apiKey,
  };
  if (merged.apiUrl && !/^https?:\/\//.test(merged.apiUrl)) {
    throw new SmmError('INVALID_API_URL', 'Panel API URL must start with http:// or https://', 400);
  }
  await setJsonSetting(PANEL_KEY, merged, 'SMM panel API config for auto-ordering views/reactions');
}

/**
 * Master switch for webhook-detected posts. Defaults OFF: a freshly configured bot must
 * never start spending panel balance on channel posts before someone opts in.
 */
export function isWebhookEnabled(): Promise<boolean> {
  return getBoolSetting(WEBHOOK_ENABLED_KEY, false);
}

export function setWebhookEnabled(enabled: boolean): Promise<void> {
  return setBoolSetting(
    WEBHOOK_ENABLED_KEY,
    enabled,
    'Master switch: place SMM orders on posts detected via the Telegram webhook',
  );
}

export type SmmQueueView = {
  id: string;
  postUrl: string;
  contextLabel: string;
  status: string;
  attempts: number;
  placed: number;
  viewsOrderId: string | null;
  reactionsOrderId: string | null;
  lastError: string | null;
  processedAt: string | null;
  createdAt: string;
};

function toView(row: SmmQueueRow): SmmQueueView {
  return {
    id: row.id,
    postUrl: row.postUrl,
    contextLabel: row.contextLabel,
    status: row.status,
    attempts: row.attempts,
    placed: row.placed,
    viewsOrderId: row.viewsOrderId,
    reactionsOrderId: row.reactionsOrderId,
    lastError: row.lastError,
    processedAt: row.processedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listQueue(limit?: number): Promise<{ items: SmmQueueView[]; counts: Record<string, number> }> {
  const [rows, counts] = await Promise.all([repo.list(limit), repo.counts()]);
  return { items: rows.map(toView), counts };
}

/** Producer API — used by the Telegram webhook and by the admin "order manually" form. */
export async function enqueue(postUrl: string, contextLabel = 'generic'): Promise<string | null> {
  if (!postUrl) return null;
  try {
    return await repo.enqueue(postUrl, contextLabel);
  } catch (err) {
    // Never let a queue write failure break the caller (a webhook must still 200).
    logger.error({ err, postUrl }, 'smm: enqueue failed');
    return null;
  }
}

export async function enqueueManual(postUrl: string): Promise<{ queued: boolean }> {
  const url = postUrl.trim();
  if (!/^https:\/\/t\.me\//.test(url)) {
    throw new SmmError('INVALID_POST_URL', 'Post URL must be a https://t.me/… link', 400);
  }
  const id = await repo.enqueue(url, 'manual');
  return { queued: Boolean(id) };
}

export async function retryQueueItem(id: string): Promise<void> {
  const row = await repo.findById(id);
  if (!row) throw new SmmError('NOT_FOUND', 'Queue item not found', 404);
  await repo.retry(id);
}

export async function deleteQueueItem(id: string): Promise<void> {
  const row = await repo.findById(id);
  if (!row) throw new SmmError('NOT_FOUND', 'Queue item not found', 404);
  await repo.remove(id);
}

export type OrderOutcome = {
  skipped: boolean;
  reason?: string;
  placed: number;
  viewsOrderId: string | null;
  reactionsOrderId: string | null;
  errors: string[];
};

/**
 * Place the configured views/reactions orders for one post. Called only by the worker,
 * one row at a time — the panel dislikes bursts, and pacing lives in the worker.
 */
export async function placeOrdersForPost(postUrl: string): Promise<OrderOutcome> {
  const cfg = await getConfig();
  const base: OrderOutcome = { skipped: false, placed: 0, viewsOrderId: null, reactionsOrderId: null, errors: [] };

  if (!cfg.enabled) return { ...base, skipped: true, reason: 'disabled' };
  if (!cfg.apiKey || !cfg.apiUrl) return { ...base, skipped: true, reason: 'missing_credentials' };

  const outcome = { ...base };
  if (cfg.viewsEnabled && cfg.viewsServiceId && cfg.viewsQuantity > 0) {
    try {
      const res = await placeOrder(cfg, cfg.viewsServiceId, cfg.viewsQuantity, postUrl, 'views');
      outcome.viewsOrderId = res.orderId;
      outcome.placed += 1;
    } catch (err) {
      outcome.errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  if (cfg.reactionsEnabled && cfg.reactionsServiceId && cfg.reactionsQuantity > 0) {
    try {
      const res = await placeOrder(cfg, cfg.reactionsServiceId, cfg.reactionsQuantity, postUrl, 'reactions');
      outcome.reactionsOrderId = res.orderId;
      outcome.placed += 1;
    } catch (err) {
      outcome.errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  // Nothing enabled at all is a definitive outcome, not a failure to retry.
  const nothingToDo =
    !(cfg.viewsEnabled && cfg.viewsServiceId && cfg.viewsQuantity > 0) &&
    !(cfg.reactionsEnabled && cfg.reactionsServiceId && cfg.reactionsQuantity > 0);
  if (nothingToDo) return { ...outcome, skipped: true, reason: 'no_services_configured' };

  return outcome;
}

/**
 * The near-universal "SMM panel" API v2 contract: form-encoded POST with
 * key/action/service/link/quantity, JSON back with either `order` or `error`.
 */
async function placeOrder(
  cfg: SmmPanelConfig,
  serviceId: string,
  quantity: number,
  link: string,
  kind: string,
): Promise<{ orderId: string | null }> {
  const body = new URLSearchParams({
    key: cfg.apiKey,
    action: 'add',
    service: String(serviceId),
    link,
    quantity: String(quantity),
  });

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_PANEL_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(cfg.apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        // Without this cap an unresponsive panel blocks the single worker for undici's
        // multi-minute default, stalling every other row behind it.
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const text = await res.text();
      let parsed: { order?: string | number; error?: string };
      try {
        parsed = JSON.parse(text) as typeof parsed;
      } catch {
        parsed = { error: text.slice(0, 200) };
      }
      if (!res.ok || parsed.error) {
        const message = `SMM ${kind} order failed: ${res.status} ${parsed.error ?? text.slice(0, 200)}`;
        // 429/5xx are worth one more shot; a rejected service id is not.
        if ((res.status === 429 || res.status >= 500) && attempt < MAX_PANEL_ATTEMPTS) {
          lastError = new Error(message);
          continue;
        }
        throw new Error(message);
      }
      logger.info({ kind, quantity, link, orderId: parsed.order }, 'smm: order placed');
      return { orderId: parsed.order == null ? null : String(parsed.order) };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // A panel-rejected order is final; only transport failures get the retry.
      if (/^SMM .* order failed:/.test(lastError.message) || attempt >= MAX_PANEL_ATTEMPTS) throw lastError;
    }
  }
  throw lastError ?? new Error(`SMM ${kind} order failed`);
}
