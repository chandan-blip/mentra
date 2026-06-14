import type { z, ZodTypeAny } from 'zod';
import { env } from '../env.js';
import { logger } from '../logger.js';

/**
 * Thin client over Groq's OpenAI-compatible Chat Completions API. Mentra uses the
 * LLM only for structured generation (assignments, roadmaps), never chat — so this
 * client forces JSON output and validates it against a caller-supplied Zod schema.
 * Callers cache the result in the DB; we never call the model speculatively.
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

type ChatCompletion = {
  choices?: { message?: { content?: string | null } }[];
};

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
  const url = `${env.AI_BASE_URL.replace(/\/$/, '')}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);
  const startedAt = Date.now();

  logger.info({ model: env.AI_MODEL }, 'ai.request');

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        temperature,
        max_tokens: env.AI_MAX_TOKENS,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
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
    logger.error({ status: res.status, detail: detail.slice(0, 500) }, 'ai.http_error');
    throw new AiError('AI_HTTP', `AI returned HTTP ${res.status}`);
  }

  const body = (await res.json()) as ChatCompletion;
  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiError('AI_PARSE', 'AI response had no content');
  }

  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw new AiError('AI_PARSE', 'AI response was not valid JSON');
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    logger.error(
      { issues: parsed.error.flatten() },
      'ai.invalid_shape',
    );
    throw new AiError('AI_INVALID', 'AI response did not match the expected schema');
  }

  logger.info({ model: env.AI_MODEL, durationMs: Date.now() - startedAt }, 'ai.response');
  return parsed.data;
}
