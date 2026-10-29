# ADR-0004: Transactional Outbox and BullMQ for Domain Events

- Status: Accepted
- Date: 2026-10-26

## Context

It is necessary to reliably publish events after data changes in PostgreSQL. Direct publishing to the queue after `COMMIT` loses events in case of a failure between two operations.

## Solution

1. The event is written to `platform.outbox_events` in the same transaction as the business change.
2. Outbox relay in `apps/worker` periodically selects un-published records (`FOR UPDATE SKIP LOCKED`, in batches) and puts tasks in BullMQ with `jobId = event.id`.
3. Handlers are idempotent: each writes `(consumer, event_id)` to `platform.processed_events` in one transaction with its own change.
4. Retry: `attempts` + exponential backoff in Bull.MQ.
5. Only side effects go through the queue. What the user should see immediately is executed synchronously.

## Alternatives

- **LISTEN/NOTIFY** — no guarantees of delivery and retries.
- **Kafka / Debezium** — overkill for the current scale.

## Implications

- Delivery at-least-once, projection delay — up to `OUTBOX_POLL_INTERVAL_MS`.
- Published outbox records need to be cleaned up (scheduled task `cleanup-event-tables` in worker (once per hour) deletes published records and marks `processed_events` older than `OUTBOX_RETENTION_DAYS`).
