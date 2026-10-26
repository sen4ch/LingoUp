import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  smallint,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamptz } from './_columns.js';

/** Infrastructure tables shared by all modules through the OutboxWriter / event consumers. */
export const platformSchema = pgSchema('platform');

export const outboxEvents = platformSchema.table(
  'outbox_events',
  {
    /** Equals the domain event id; also used as the BullMQ job id for de-duplication. */
    id: uuid('id').primaryKey(),
    type: text('type').notNull(),
    version: smallint('version').notNull(),
    /** Owner of the event; used to purge events when an account is deleted. No FK on purpose. */
    userId: uuid('user_id'),
    /** Full event envelope as defined in @lingoup/contracts/events. */
    event: jsonb('event').notNull(),
    occurredAt: timestamptz('occurred_at').notNull(),
    publishedAt: timestamptz('published_at'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => [
    index('outbox_events_unpublished_idx')
      .on(t.occurredAt)
      .where(sql`${t.publishedAt} IS NULL`),
    index('outbox_events_published_at_idx')
      .on(t.publishedAt)
      .where(sql`${t.publishedAt} IS NOT NULL`),
    index('outbox_events_user_id_idx').on(t.userId),
  ],
);

/** Idempotency ledger for event consumers. */
export const processedEvents = platformSchema.table(
  'processed_events',
  {
    consumer: text('consumer').notNull(),
    eventId: uuid('event_id').notNull(),
    processedAt: timestamptz('processed_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'processed_events_pkey', columns: [t.consumer, t.eventId] }),
    index('processed_events_processed_at_idx').on(t.processedAt),
  ],
);
