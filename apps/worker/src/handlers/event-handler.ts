import type { DomainEvent } from '@lingoup/contracts/events';

/**
 * A consumer of domain events. Implementations must be idempotent: the same event can be
 * delivered more than once (at-least-once delivery).
 */
export interface EventHandler {
  /** Stable name; used as the idempotency key in platform.processed_events. */
  readonly consumer: string;
  handles(event: DomainEvent): boolean;
  handle(event: DomainEvent): Promise<void>;
}
