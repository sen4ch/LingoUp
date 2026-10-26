import type { Database } from '@lingoup/database';
import { outboxEvents, processedEvents } from '@lingoup/database/schema/platform';
import { and, isNotNull, lt } from 'drizzle-orm';

export const MAINTENANCE_QUEUE = 'maintenance';
export const CLEANUP_JOB = 'cleanup-event-tables';

/**
 * Deletes published outbox rows and idempotency records older than the retention window.
 * The window must exceed the maximum redelivery delay of the queue (retries + backoff).
 */
export async function cleanupEventTables(db: Database, retentionDays: number, now = new Date()) {
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);
  const outbox = await db
    .delete(outboxEvents)
    .where(and(isNotNull(outboxEvents.publishedAt), lt(outboxEvents.publishedAt, cutoff)))
    .returning({ id: outboxEvents.id });
  const processed = await db
    .delete(processedEvents)
    .where(lt(processedEvents.processedAt, cutoff))
    .returning({ id: processedEvents.eventId });
  return { outboxDeleted: outbox.length, processedDeleted: processed.length };
}
