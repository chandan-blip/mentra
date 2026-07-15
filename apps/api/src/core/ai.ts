import type { z, ZodTypeAny } from 'zod';
import { env } from '../env.js';
import { logger } from '../logger.js';

/**
 * Thin client over any OpenAI-compatible Chat Completions API. Mentra uses it for:
 *  - `generateJson` — structured generation (assignments, roadmaps) on Groq (`AI_*`).
 *  - `generateChatJson` — the mentor-chat coach, over a FAILOVER CHAIN of free providers
 *    (`AI_CHAT_<PROVIDER>_*`). Each configured provider is tried in order; the first to
 *    answer wins, so one provider being down/overloaded just moves traffic to the next.
 * Both force JSON output and validate it against a caller-supplied Zod schema. Callers
 * persist the result in the DB; we never call the model speculatively.
 */
export class AiError extends Error {
  constructor(
    public readonly code: 'AI_HTTP' | 'AI_PARSE' | 'AI_INVALID' | 'AI_TIMEOUT',
    message: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

/** One turn in a chat request (system sets the contract; user/assistant are the history). */
export type AiChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type GenerateJsonInput<S extends ZodTypeAny> = {
  /** System prompt — sets the role and the strict "JSON only" contract. */
  system: string;
  /** User prompt — the concrete, context-rich instruction. */
  user: string;
  /** Validates (and types) the model's JSON. Generation fails if it doesn't match. */
  schema: S;
  /** Override the default sampling temperature (kept low for determinism). */
  temperature?: number;
};

type GenerateChatJsonInput<S extends ZodTypeAny> = {
  /** Full message array (system first, then the alternating user/assistant history). */
  messages: AiChatMessage[];
  /** Validates (and types) the model's JSON reply. */
  schema: S;
  /** Sampling temperature — a touch higher for a natural, human conversation. */
  temperature?: number;
};

type ChatCompletion = {
  choices?: { message?: { content?: string | null } }[];
};

/** Everything needed to reach one OpenAI-compatible endpoint (`name` is for logging). */
type AiProvider = { name: string; baseUrl: string; apiKey: string; model: string };

/** Groq (`AI_*`) — structured generation. */
function structuredProvider(): AiProvider {
  return { name: 'groq', baseUrl: env.AI_BASE_URL, apiKey: env.AI_API_KEY, model: env.AI_MODEL };
}

/**
 * The mentor-chat coach's failover chain: the free providers with an API key set, in a
 * fixed preference order. Each is OpenAI-compatible, so they share the same request path.
 * `generateChatJson` walks this list and returns the first success. If none are keyed,
 * chat falls back to the Groq structured creds so it still works out of the box.
 */
function chatProviders(): AiProvider[] {
  const candidates: (AiProvider | null)[] = [
    env.AI_CHAT_GROQ_API_KEY
      ? { name: 'groq', baseUrl: env.AI_CHAT_GROQ_BASE_URL, apiKey: env.AI_CHAT_GROQ_API_KEY, model: env.AI_CHAT_GROQ_MODEL }
      : null,
    env.AI_CHAT_GEMINI_API_KEY
      ? { name: 'gemini', baseUrl: env.AI_CHAT_GEMINI_BASE_URL, apiKey: env.AI_CHAT_GEMINI_API_KEY, model: env.AI_CHAT_GEMINI_MODEL }
      : null,
    env.AI_CHAT_OPENROUTER_API_KEY
      ? { name: 'openrouter', baseUrl: env.AI_CHAT_OPENROUTER_BASE_URL, apiKey: env.AI_CHAT_OPENROUTER_API_KEY, model: env.AI_CHAT_OPENROUTER_MODEL }
      : null,
    env.AI_CHAT_CEREBRAS_API_KEY
      ? { name: 'cerebras', baseUrl: env.AI_CHAT_CEREBRAS_BASE_URL, apiKey: env.AI_CHAT_CEREBRAS_API_KEY, model: env.AI_CHAT_CEREBRAS_MODEL }
      : null,
    env.AI_CHAT_MISTRAL_API_KEY
      ? { name: 'mistral', baseUrl: env.AI_CHAT_MISTRAL_BASE_URL, apiKey: env.AI_CHAT_MISTRAL_API_KEY, model: env.AI_CHAT_MISTRAL_MODEL }
      : null,
  ];
  const chain = candidates.filter((p): p is AiProvider => p !== null);
  return chain.length > 0 ? chain : [structuredProvider()];
}

/**
 * Pull a JSON object out of the model's reply. We ask for a raw JSON object, but some
 * OpenAI-compatible layers (notably Gemini's) ignore `response_format` and wrap the
 * object in a ```json fence or add stray prose, so we tolerate that by stripping fences
 * and, as a last resort, slicing the outermost `{…}` before parsing.
 */
function parseJsonContent(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through to the typed error below */
      }
    }
    throw new AiError('AI_PARSE', 'AI response was not valid JSON');
  }
}

/**
 * One POST to `provider`, forcing a JSON object, returning the parsed (but not yet
 * schema-validated) content. Throws `AiError` on transport / parse failure — the chat
 * failover chain treats any throw as "try the next provider" (no same-provider retry).
 */
async function requestJson(
  messages: AiChatMessage[],
  temperature: number,
  provider: AiProvider,
): Promise<unknown> {
  const url = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);
  const startedAt = Date.now();

  logger.info({ provider: provider.name, model: provider.model }, 'ai.request');

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature,
        max_tokens: env.AI_MAX_TOKENS,
        response_format: { type: 'json_object' },
        messages,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AiError('AI_TIMEOUT', `AI request timed out after ${env.AI_TIMEOUT_MS}ms`);
    }
    throw new AiError('AI_HTTP', `AI request failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    logger.error(
      { provider: provider.name, status: res.status, model: provider.model, detail: detail.slice(0, 500) },
      'ai.http_error',
    );
    throw new AiError('AI_HTTP', `AI returned HTTP ${res.status}`);
  }

  const body = (await res.json()) as ChatCompletion;
  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiError('AI_PARSE', 'AI response had no content');
  }

  const json = parseJsonContent(content);
  logger.info({ provider: provider.name, model: provider.model, durationMs: Date.now() - startedAt }, 'ai.response');
  return json;
}

/** Validate parsed JSON against the schema, throwing a typed `AiError` on mismatch. */
function validate<S extends ZodTypeAny>(json: unknown, schema: S): z.infer<S> {
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    logger.error({ issues: parsed.error.flatten() }, 'ai.invalid_shape');
    throw new AiError('AI_INVALID', 'AI response did not match the expected schema');
  }
  return parsed.data;
}

/**
 * Ask the model for a JSON object and return it validated as `T`. Throws `AiError`
 * on transport, parse, or schema-validation failure — callers decide how to surface it.
 */
export async function generateJson<S extends ZodTypeAny>({
  system,
  user,
  schema,
  temperature = 0.4,
}: GenerateJsonInput<S>): Promise<z.infer<S>> {
  const json = await requestJson(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature,
    structuredProvider(),
  );
  return validate(json, schema);
}

/**
 * Multi-turn variant powering the mentor-chat coach. Walks the free-provider failover
 * chain in order: the first provider to return a schema-valid JSON reply wins. Any
 * failure — HTTP error, timeout, bad/parse-failing JSON, or a schema mismatch — just
 * moves on to the next provider. Throws the last error only if EVERY provider fails,
 * which the service turns into the busy-mentor fallback.
 */
export async function generateChatJson<S extends ZodTypeAny>({
  messages,
  schema,
  temperature = 0.6,
}: GenerateChatJsonInput<S>): Promise<z.infer<S>> {
  const providers = chatProviders();
  let lastErr: unknown;
  for (const provider of providers) {
    try {
      const json = await requestJson(messages, temperature, provider);
      return validate(json, schema);
    } catch (err) {
      lastErr = err;
      logger.warn(
        { provider: provider.name, err: err instanceof Error ? err.message : String(err) },
        'ai.chat_failover',
      );
    }
  }
  throw lastErr ?? new AiError('AI_HTTP', 'No chat provider is configured');
}
