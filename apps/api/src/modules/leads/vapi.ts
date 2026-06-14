import { env } from '../../env.js';
import { logger } from '../../logger.js';

/**
 * Thin client over the Vapi REST API for placing outbound AI phone calls. Mentra
 * only kicks off calls and stores the returned call id; call progress + results
 * arrive asynchronously on the webhook (see leads.routes / leads.service). Empty
 * credentials disable calling (the app still boots) — callers check `vapiConfigured()`.
 */

export class VapiError extends Error {
  constructor(
    public readonly code: 'VAPI_HTTP' | 'VAPI_TIMEOUT' | 'VAPI_PARSE',
    message: string,
  ) {
    super(message);
    this.name = 'VapiError';
  }
}

/** Which of the required Vapi env vars are missing/empty in this process. */
export function missingVapiVars(): string[] {
  const missing: string[] = [];
  if (!env.VAPI_API_KEY) missing.push('VAPI_API_KEY');
  if (!env.VAPI_ASSISTANT_ID) missing.push('VAPI_ASSISTANT_ID');
  if (!env.VAPI_PHONE_NUMBER_ID) missing.push('VAPI_PHONE_NUMBER_ID');
  return missing;
}

export function vapiConfigured(): boolean {
  return missingVapiVars().length === 0;
}

/** Pull a human-readable reason out of a Vapi error body ({ message, error }). */
function extractVapiMessage(detail: string): string {
  try {
    const body = JSON.parse(detail) as { message?: unknown; error?: unknown };
    const msg = body.message ?? body.error;
    if (Array.isArray(msg)) return msg.join('; ');
    if (typeof msg === 'string') return msg;
  } catch {
    /* not JSON */
  }
  return detail.slice(0, 200) || 'no detail';
}

export type VapiCallResult = { id: string; status: string };

/** Place a single outbound call. `customer.number` must be E.164 (e.g. +14155551234). */
export async function createCall(input: {
  assistantId: string;
  phoneNumberId: string;
  number: string;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<VapiCallResult> {
  const url = `${env.VAPI_BASE_URL.replace(/\/$/, '')}/call`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.VAPI_API_KEY}`,
      },
      body: JSON.stringify({
        assistantId: input.assistantId,
        phoneNumberId: input.phoneNumberId,
        customer: { number: input.number, name: input.name },
        metadata: input.metadata,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new VapiError('VAPI_TIMEOUT', 'Vapi request timed out');
    }
    throw new VapiError('VAPI_HTTP', `Vapi request failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    logger.error({ status: res.status, detail: detail.slice(0, 1000) }, 'vapi.http_error');
    throw new VapiError('VAPI_HTTP', `Vapi HTTP ${res.status}: ${extractVapiMessage(detail)}`);
  }

  const body = (await res.json().catch(() => null)) as { id?: string; status?: string } | null;
  if (!body?.id) throw new VapiError('VAPI_PARSE', 'Vapi response had no call id');
  return { id: body.id, status: body.status ?? 'queued' };
}

/** Map a Vapi call status string onto our coarse LeadCall status. */
export function mapVapiStatus(status: string | undefined): 'queued' | 'ringing' | 'in-progress' | 'ended' | 'failed' {
  switch (status) {
    case 'queued':
    case 'scheduled':
      return 'queued';
    case 'ringing':
      return 'ringing';
    case 'in-progress':
    case 'forwarding':
      return 'in-progress';
    case 'ended':
      return 'ended';
    default:
      return status === 'failed' ? 'failed' : 'queued';
  }
}
