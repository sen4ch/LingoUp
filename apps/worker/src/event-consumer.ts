import { DomainEventSchema, DOMAIN_EVENTS_QUEUE } from '@lingoup/contracts/events';
import { UnrecoverableError, Worker, type ConnectionOptions, type Job } from 'bullmq';
import type { Logger } from 'pino';
import type { EventHandler } from './handlers/event-handler.js';

/**
 * Consumes the domain-events queue and dispatches each event to every interested handler.
 * If one handler fails the job is retried; handlers that already succeeded skip the event
 * thanks to their own idempotency records.
 */
export function createEventConsumer(options: {
  connection: ConnectionOptions;
  handlers: readonly EventHandler[];
  concurrency: number;
  logger: Logger;
}): Worker {
  const { handlers, logger } = options;
  return new Worker(
    DOMAIN_EVENTS_QUEUE,
    async (job: Job) => {
      const parsed = DomainEventSchema.safeParse(job.data);
      if (!parsed.success) {
        // A contract violation will not fix itself on retry.
        throw new UnrecoverableError(`Event ${String(job.id)} does not match any known contract`);
      }
      const event = parsed.data;
      for (const handler of handlers) {
        if (handler.handles(event)) await handler.handle(event);
      }
      logger.debug({ eventId: event.id, type: event.type }, 'Event processed');
    },
    { connection: options.connection, concurrency: options.concurrency, autorun: false },
  );
}
