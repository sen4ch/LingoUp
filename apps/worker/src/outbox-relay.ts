import type { Database } from '@lingoup/database';
import { outboxEvents } from '@lingoup/database/schema/platform';
import type { Queue } from 'bullmq';
import { asc, inArray, isNull, sql } from 'drizzle-orm';
import type { Logger } from 'pino';

export interface OutboxRelayOptions {
  batchSize: number;
  pollIntervalMs: number;
}

/**
 * Moves committed events from platform.outbox_events to the BullMQ queue.
 *
 * - Rows are claimed with FOR UPDATE SKIP LOCKED, so several worker replicas can relay in
 *   parallel without publishing the same batch twice.
 * - The job id equals the event id: if a crash happens after enqueueing but before the
 *   commit, the retry is de-duplicated by BullMQ (and consumers are idempotent anyway).
 */
export class OutboxRelay {
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;
  private stopped = false;

  constructor(
    private readonly db: Database,
    private readonly queue: Queue,
    private readonly options: OutboxRelayOptions,
    private readonly logger: Logger,
  ) {}

  start(): void {
    this.stopped = false;
    this.schedule(0);
  }

  /** Stops polling and waits for the in-flight batch to finish. */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.running;
  }

  /** Relays one batch; returns the number of events published. */
  async relayOnce(): Promise<number> {
    try {
      return await this.db.transaction(async (tx) => {
        const batch = await tx
          .select({ id: outboxEvents.id, type: outboxEvents.type, event: outboxEvents.event })
          .from(outboxEvents)
          .where(isNull(outboxEvents.publishedAt))
          .orderBy(asc(outboxEvents.occurredAt))
          .limit(this.options.batchSize)
          .for('update', { skipLocked: true });
        if (batch.length === 0) return 0;

        await this.queue.addBulk(
          batch.map((row) => ({ name: row.type, data: row.event, opts: { jobId: row.id } })),
        );
        await tx
          .update(outboxEvents)
          .set({ publishedAt: sql`now()`, attempts: sql`${outboxEvents.attempts} + 1` })
          .where(
            inArray(
              outboxEvents.id,
              batch.map((row) => row.id),
            ),
          );
        return batch.length;
      });
    } catch (error) {
      await this.recordFailure(error);
      throw error;
    }
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.running = this.tick();
    }, delayMs);
  }

  private async tick(): Promise<void> {
    let published = 0;
    try {
      published = await this.relayOnce();
      if (published > 0) this.logger.debug({ published }, 'Outbox events relayed');
    } catch (error) {
      this.logger.error({ err: error }, 'Outbox relay failed; will retry');
    }
    // A full batch means there is probably more work: continue immediately.
    this.schedule(published === this.options.batchSize ? 0 : this.options.pollIntervalMs);
  }

  private async recordFailure(error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'unknown error';
    try {
      // Bookkeeping only for the oldest unpublished events, which are the ones being retried.
      await this.db.execute(sql`
        UPDATE ${outboxEvents}
        SET attempts = attempts + 1, last_error = ${message}
        WHERE id IN (
          SELECT id FROM ${outboxEvents}
          WHERE published_at IS NULL
          ORDER BY occurred_at
          LIMIT ${this.options.batchSize}
          FOR UPDATE SKIP LOCKED
        )`);
    } catch {
      // The database itself may be unavailable; the original error is reported by the caller.
    }
  }
}
