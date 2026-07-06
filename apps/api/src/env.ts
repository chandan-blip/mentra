import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_APP_ORIGIN: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_COOKIE_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  // Resume upload (stored on local disk)
  RESUME_STORAGE_DIR: z.string().min(1).default('var/uploads'),
  RESUME_MAX_BYTES: z.coerce.number().int().positive().default(5_242_880),
  // Profile-picture upload (stored on local disk under the same storage root)
  AVATAR_MAX_BYTES: z.coerce.number().int().positive().default(2_097_152),

  PROFILE_DEFAULT_TIMEZONE: z.string().min(1).default('Asia/Kolkata'),

  // AI (Groq, OpenAI-compatible). Powers personalized assignments + roadmaps.
  AI_API_KEY: z.string().min(1),
  AI_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),
  AI_MODEL: z.string().min(1).default('llama-3.3-70b-versatile'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  AI_MAX_TOKENS: z.coerce.number().int().positive().default(4_096),

  // Dashboard (module 04)
  DASHBOARD_RECOMMENDER_STRATEGY: z.enum(['default']).default('default'),
  DASHBOARD_NEXT_STEPS_LIMIT: z.coerce.number().int().positive().max(20).default(5),

  // Roadmap (module 05)
  ROADMAP_GENERATOR_STRATEGY: z.enum(['default', 'ai']).default('default'),
  ROADMAP_AUTO_REGEN_THROTTLE_SECONDS: z.coerce.number().int().positive().default(21_600),
  ROADMAP_MAX_WEEKS: z.coerce.number().int().positive().default(16),
  ROADMAP_MIN_ITEMS_PER_WEEK: z.coerce.number().int().positive().default(3),
  ROADMAP_MAX_ITEMS_PER_WEEK: z.coerce.number().int().positive().default(8),
  ROADMAP_GENERATOR_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),

  // Topic subtopics + completion test (AI on demand, cached in DB)
  ROADMAP_SUBTOPICS_MIN: z.coerce.number().int().positive().default(4),
  ROADMAP_SUBTOPICS_MAX: z.coerce.number().int().positive().default(12),
  // Questions the AI should produce per subtopic; total is clamped to the cap below.
  ROADMAP_TEST_QUESTIONS_PER_SUBTOPIC: z.coerce.number().int().positive().default(2),
  ROADMAP_TEST_MAX_QUESTIONS: z.coerce.number().int().positive().default(40),
  // Minimum percent required to pass the test and mark the topic complete.
  ROADMAP_TEST_PASS_PERCENT: z.coerce.number().int().min(1).max(100).default(70),

  // Live sessions (module 06) — self-hosted LiveKit SFU.
  // LIVEKIT_URL: server→LiveKit control plane (RoomServiceClient), e.g. http://livekit:7880
  // LIVEKIT_WS_URL: public ws(s) URL the browser connects to (returned in join-token).
  LIVEKIT_URL: z.string().url().default('http://livekit:7880'),
  LIVEKIT_WS_URL: z.string().min(1).default('ws://localhost:7880'),
  LIVEKIT_API_KEY: z.string().min(1).default('devkey'),
  LIVEKIT_API_SECRET: z.string().min(1).default('devsecret_change_me_at_least_32_chars_xxxx'),
  // Access-token lifetime for a room join (seconds).
  LIVEKIT_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(21_600),

  // Recordings storage — Cloudflare R2 (S3-compatible). Empty = recordings pipeline
  // disabled, app still boots. R2_ENDPOINT is the S3 API endpoint
  // (https://<accountid>.r2.cloudflarestorage.com); region is always 'auto' for R2.
  // R2_PUBLIC_BASE_URL is the public CDN domain that serves the HLS .m3u8/.ts files
  // (the bucket itself stays private to the API/worker). Secrets live in .env only.
  R2_ACCOUNT_ID: z.string().default(''),
  R2_ENDPOINT: z.string().default(''),
  R2_REGION: z.string().default('auto'),
  R2_ACCESS_KEY_ID: z.string().default(''),
  R2_SECRET_ACCESS_KEY: z.string().default(''),
  R2_BUCKET: z.string().default(''),
  R2_PUBLIC_BASE_URL: z.string().default(''),

  // Marketing — LinkedIn OAuth (optional; empty = feature disabled, app still boots).
  LINKEDIN_CLIENT_ID: z.string().default(''),
  LINKEDIN_CLIENT_SECRET: z.string().default(''),
  // The OAuth redirect URL registered in the LinkedIn app — points at the API callback,
  // e.g. http://localhost:4000/api/v1/marketing/linkedin/callback
  LINKEDIN_REDIRECT_URI: z.string().default(''),
  LINKEDIN_SCOPES: z.string().default('openid profile email w_member_social'),

  // Marketing — Vapi AI calling (optional; empty = calling disabled, app still boots).
  // VAPI_API_KEY: server (private) key. VAPI_ASSISTANT_ID + VAPI_PHONE_NUMBER_ID are
  // created in the Vapi dashboard. VAPI_WEBHOOK_SECRET (optional) is checked against
  // the X-Vapi-Secret header on inbound webhooks.
  VAPI_BASE_URL: z.string().url().default('https://api.vapi.ai'),
  // NOTE: these defaults are a local-testing fallback so calling works even when the
  // process didn't load .env. Override them via env in any real/shared deployment —
  // do NOT rely on hardcoded credentials in production.
  VAPI_API_KEY: z.string().default('3c4f169e-88d8-4113-82ee-5967a7354640'),
  VAPI_ASSISTANT_ID: z.string().default('7a6a7344-090e-4415-a808-cbce9ad803d8'),
  VAPI_PHONE_NUMBER_ID: z.string().default('93e2ae04-6e26-4295-ab76-a5acfd113544'),
  VAPI_WEBHOOK_SECRET: z.string().default(''),
  // Safety cap on how many leads a single list "call" run will dial.
  VAPI_MAX_CALLS_PER_RUN: z.coerce.number().int().positive().default(50),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof EnvSchema>;
