import { loadEnv } from '@lingoup/shared';
import { z } from 'zod';

const EnvSchema = z.object({
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(5),
  VALKEY_URL: z.url(),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(100).max(60_000).default(1000),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(1000).default(100),
  OUTBOX_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(7),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(10),
});

export type WorkerConfig = z.infer<typeof EnvSchema>;

export const loadWorkerConfig = (
  source: Record<string, string | undefined> = process.env,
): WorkerConfig => loadEnv(EnvSchema, source);
