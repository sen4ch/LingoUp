import { loadEnv } from '@lingoup/shared';
import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

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
  AI_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(256).default(4),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(1),
  AI_DAILY_QUOTA_PER_USER: z.coerce.number().int().min(0).default(200),
  AI_ALLOW_EXTERNAL: booleanString.default(false),
});

export type AppConfig = ReturnType<typeof loadAppConfig>;

export function loadAppConfig(source: Record<string, string | undefined> = process.env) {
  const env = loadEnv(
    EnvSchema.refine((value) => value.AI_PROVIDER !== 'ai-service' || value.AI_SERVICE_TOKEN, {
      message: 'AI_SERVICE_TOKEN is required when AI_PROVIDER=ai-service',
      path: ['AI_SERVICE_TOKEN'],
    }),
    source,
  );
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
      maxConcurrency: env.AI_MAX_CONCURRENCY,
      maxRetries: env.AI_MAX_RETRIES,
      dailyQuotaPerUser: env.AI_DAILY_QUOTA_PER_USER,
      allowExternal: env.AI_ALLOW_EXTERNAL,
    },
  };
}
