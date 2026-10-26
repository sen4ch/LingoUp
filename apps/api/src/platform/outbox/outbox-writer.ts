import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  DomainEventSchema,
  type DomainEvent,
  type NewDomainEvent,
} from '@lingoup/contracts/events';
import type { DbExecutor } from '@lingoup/database';
import { outboxEvents } from '@lingoup/database/schema/platform';
import { eq } from 'drizzle-orm';

/**
 * Transactional outbox. Call `append` with the same transaction that performs the
 * business change; the worker relays committed events to the queue.
 */
@Injectable()
export class OutboxWriter {
  async append(
    tx: DbExecutor,
    event: NewDomainEvent,
    occurredAt = new Date(),
  ): Promise<DomainEvent> {
    // Validating here catches contract drift at the producer, not in a background job.
    const envelope = DomainEventSchema.parse({
      ...event,
      id: randomUUID(),
      occurredAt: occurredAt.toISOString(),
    });
    await tx.insert(outboxEvents).values({
      id: envelope.id,
      type: envelope.type,
      version: envelope.version,
      userId: envelope.userId,
      event: envelope,
      occurredAt,
    });
    return envelope;
  }

  /** Removes a user's events (published or not) as part of account deletion. */
  async purgeUser(tx: DbExecutor, userId: string): Promise<void> {
    await tx.delete(outboxEvents).where(eq(outboxEvents.userId, userId));
  }
}
