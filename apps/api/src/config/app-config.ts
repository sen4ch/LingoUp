import { assertNoPlaceholderSecrets, loadEnv } from '@lingoup/shared';
import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

/** Compose passes unset variables as empty strings; treat them as absent. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Loopback by default; containers set 0.0.0.0 explicitly.
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  VALKEY_URL: z.url(),
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  COOKIE_SECURE: booleanString.default(false),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  TRUST_PROXY: z
    .string()
    .default('false')
    // true/false, or a comma-separated list of trusted proxy addresses/CIDRs.
    .transform((value): boolean | string => {
      if (value === 'true') return true;
      if (value === 'false' || value === '') return false;
      return value;
    }),
  SWAGGER_ENABLED: booleanString.default(true),
  BODY_LIMIT_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(10 * 1024 * 1024)
    .default(64 * 1024),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(300),
  AI_PROVIDER: z.enum(['mock', 'ai-service', 'none']).default('mock'),
  AI_SERVICE_URL: z.url().default('http://localhost:8000'),
  AI_SERVICE_TOKEN: z.string().min(32, 'must be at least 32 characters').optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(20_000),
  // Text and exercise generation write much more output than a word explanation.
  AI_GENERATION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600_000).default(120_000),
  AI_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(256).default(4),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(1),
  AI_DAILY_QUOTA_PER_USER: z.coerce.number().int().min(0).default(200),
  AI_ALLOW_EXTERNAL: booleanString.default(false),
  // Pronunciation audio. Setting azure is the administrator's opt-in to this external service.
  // edge: Microsoft Edge read-aloud voices through ai-service (edge-tts), free and keyless.
  SPEECH_PROVIDER: z.enum(['none', 'edge', 'azure']).default('none'),
  AZURE_SPEECH_KEY: optional(z.string().min(16)),
  AZURE_SPEECH_REGION: optional(
    z.string().regex(/^[a-z0-9]+$/, 'Azure region name, e.g. westeurope'),
  ),
  AZURE_SPEECH_VOICE: z
    .string()
    .regex(/^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9]+Neural$/, 'Azure neural voice name')
    .default('en-US-DerekMultilingualNeural'),
  EDGE_SPEECH_VOICE: z
    .string()
    .regex(/^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9]+Neural$/, 'Edge neural voice name')
    .default('en-US-AndrewMultilingualNeural'),
  // Picture search for words, both free and keyless: wikimedia (Wikimedia Commons) or
  // openverse (Wikimedia, Flickr and more; the public service is sometimes overloaded).
  IMAGE_SEARCH_PROVIDER: z.enum(['none', 'wikimedia', 'openverse']).default('none'),
  SPEAKING_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SPEECH_CACHE_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
});

export type AppConfig = ReturnType<typeof loadAppConfig>;

export function loadAppConfig(source: Record<string, string | undefined> = process.env) {
  const env = loadEnv(
    EnvSchema.refine((value) => value.AI_PROVIDER !== 'ai-service' || value.AI_SERVICE_TOKEN, {
      message: 'AI_SERVICE_TOKEN is required when AI_PROVIDER=ai-service',
      path: ['AI_SERVICE_TOKEN'],
    })
      .refine(
        (value) =>
          value.SPEECH_PROVIDER !== 'azure' ||
          (value.AZURE_SPEECH_KEY !== undefined && value.AZURE_SPEECH_REGION !== undefined),
        {
          message:
            'AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are required when SPEECH_PROVIDER=azure',
          path: ['AZURE_SPEECH_KEY'],
        },
      )
      .refine((value) => value.SPEECH_PROVIDER !== 'edge' || value.AI_SERVICE_TOKEN, {
        message:
          'AI_SERVICE_TOKEN is required when SPEECH_PROVIDER=edge (speech runs in ai-service)',
        path: ['AI_SERVICE_TOKEN'],
      }),
    source,
  );
  assertNoPlaceholderSecrets(env.NODE_ENV, {
    DATABASE_URL: env.DATABASE_URL,
    VALKEY_URL: env.VALKEY_URL,
    AI_SERVICE_TOKEN: env.AI_SERVICE_TOKEN,
    AZURE_SPEECH_KEY: env.AZURE_SPEECH_KEY,
  });
  return {
    env: env.NODE_ENV,
    http: {
      host: env.API_HOST,
      port: env.API_PORT,
      bodyLimitBytes: env.BODY_LIMIT_BYTES,
      trustProxy: env.TRUST_PROXY,
      allowedOrigins: env.ALLOWED_ORIGINS,
      swaggerEnabled: env.SWAGGER_ENABLED,
      rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
    },
    logLevel: env.LOG_LEVEL,
    database: { url: env.DATABASE_URL, poolMax: env.DATABASE_POOL_MAX },
    valkey: { url: env.VALKEY_URL },
    session: {
      ttlDays: env.SESSION_TTL_DAYS,
      cookieSecure: env.COOKIE_SECURE,
    },
    ai: {
      provider: env.AI_PROVIDER,
      serviceUrl: env.AI_SERVICE_URL,
      serviceToken: env.AI_SERVICE_TOKEN ?? null,
      timeoutMs: env.AI_TIMEOUT_MS,
      generationTimeoutMs: env.AI_GENERATION_TIMEOUT_MS,
      maxConcurrency: env.AI_MAX_CONCURRENCY,
      maxRetries: env.AI_MAX_RETRIES,
      dailyQuotaPerUser: env.AI_DAILY_QUOTA_PER_USER,
      allowExternal: env.AI_ALLOW_EXTERNAL,
    },
    images: { searchProvider: env.IMAGE_SEARCH_PROVIDER },
    speaking: { enabled: env.SPEAKING_ENABLED },
    speech: {
      provider: env.SPEECH_PROVIDER,
      azure:
        env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION
          ? { key: env.AZURE_SPEECH_KEY, region: env.AZURE_SPEECH_REGION }
          : null,
      voice: env.SPEECH_PROVIDER === 'edge' ? env.EDGE_SPEECH_VOICE : env.AZURE_SPEECH_VOICE,
      cacheTtlSeconds: env.SPEECH_CACHE_TTL_DAYS * 24 * 60 * 60,
    },
  };
}
