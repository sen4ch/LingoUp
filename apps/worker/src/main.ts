import { DOMAIN_EVENTS_QUEUE } from '@lingoup/contracts/events';
import { createDatabase } from '@lingoup/database';
import { LOG_REDACT_PATHS } from '@lingoup/shared';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { pino } from 'pino';
import { loadWorkerConfig } from './config.js';
import { createEventConsumer } from './event-consumer.js';
import { ProgressProjector } from './handlers/progress-projector.js';
import { cleanupEventTables, CLEANUP_JOB, MAINTENANCE_QUEUE } from './maintenance.js';
import { OutboxRelay } from './outbox-relay.js';

const config = loadWorkerConfig();
const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: 'worker' },
  redact: { paths: [...LOG_REDACT_PATHS], censor: '[redacted]' },
});

// BullMQ requires maxRetriesPerRequest: null for blocking connections.
const connection = new Redis(config.VALKEY_URL, { maxRetriesPerRequest: null });
const database = createDatabase({
  connectionString: config.DATABASE_URL,
  max: config.DATABASE_POOL_MAX,
  applicationName: 'lingoup-worker',
  onIdleClientError: (error) => {
    logger.warn({ err: error }, 'PostgreSQL idle connection error; reconnecting on demand');
  },
});

const eventsQueue = new Queue(DOMAIN_EVENTS_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 8,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 24 * 3600, count: 10_000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});
const maintenanceQueue = new Queue(MAINTENANCE_QUEUE, { connection });

const relay = new OutboxRelay(
  database.db,
  eventsQueue,
  { batchSize: config.OUTBOX_BATCH_SIZE, pollIntervalMs: config.OUTBOX_POLL_INTERVAL_MS },
  logger.child({ component: 'outbox-relay' }),
);

const consumer = createEventConsumer({
  connection,
  handlers: [new ProgressProjector(database.db)],
  concurrency: config.WORKER_CONCURRENCY,
  logger: logger.child({ component: 'event-consumer' }),
});
consumer.on('failed', (job, error) => {
  logger.warn(
    { jobId: job?.id, name: job?.name, attempts: job?.attemptsMade, err: error },
    'Event job failed',
  );
});

const maintenance = new Worker(
  MAINTENANCE_QUEUE,
  async () => {
    const result = await cleanupEventTables(database.db, config.OUTBOX_RETENTION_DAYS);
    logger.info(result, 'Event tables cleaned up');
  },
  { connection, autorun: false },
);

async function start(): Promise<void> {
  // Idempotent: one schedule regardless of how many worker replicas start.
  await maintenanceQueue.upsertJobScheduler(
    CLEANUP_JOB,
    { every: 60 * 60 * 1000 },
    { name: CLEANUP_JOB },
  );
  relay.start();
  void consumer.run();
  void maintenance.run();
  logger.info({ concurrency: config.WORKER_CONCURRENCY }, 'Worker started');
}

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down: finishing in-flight work');
  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    process.exit(1);
  }, 25_000);
  forceExit.unref();
  // Order matters: stop producing, let consumers drain, then close connections.
  await relay.stop();
  await Promise.allSettled([consumer.close(), maintenance.close()]);
  await Promise.allSettled([eventsQueue.close(), maintenanceQueue.close()]);
  await Promise.allSettled([database.close(), connection.quit()]);
  logger.info('Worker stopped');
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

start().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Worker failed to start');
  process.exit(1);
});
