import type { DomainEvent } from '@lingoup/contracts/events';
import { isPgError, PG_ERROR, type Database } from '@lingoup/database';
import { processedEvents } from '@lingoup/database/schema/platform';
import { dailyActivity } from '@lingoup/database/schema/progress';
import { sql } from 'drizzle-orm';
import type { EventHandler } from './event-handler.js';

type Counter = 'wordsSaved' | 'reviewsDone' | 'textsCompleted' | 'exercisesDone';

const COUNTER_BY_EVENT: Partial<Record<DomainEvent['type'], Counter>> = {
  WordSaved: 'wordsSaved',
  VocabularyReviewCompleted: 'reviewsDone',
  LessonCompleted: 'textsCompleted',
  ExerciseCompleted: 'exercisesDone',
};

/**
 * Write side of the Progress module: projects learning events into per-day counters.
 * Idempotent: the processed_events insert and the counter update share one transaction.
 */
export class ProgressProjector implements EventHandler {
  readonly consumer = 'progress.daily-activity';

  constructor(private readonly db: Database) {}

  handles(event: DomainEvent): boolean {
    return event.userId !== null && COUNTER_BY_EVENT[event.type] !== undefined;
  }

  async handle(event: DomainEvent): Promise<void> {
    const counter = COUNTER_BY_EVENT[event.type];
    const userId = event.userId;
    if (!counter || !userId) return;
    const day = event.occurredAt.slice(0, 10);

    try {
      await this.db.transaction(async (tx) => {
        const claimed = await tx
          .insert(processedEvents)
          .values({ consumer: this.consumer, eventId: event.id })
          .onConflictDoNothing()
          .returning({ eventId: processedEvents.eventId });
        if (claimed.length === 0) return; // Already projected.

        await tx
          .insert(dailyActivity)
          .values({ userId, day, [counter]: 1 })
          .onConflictDoUpdate({
            target: [dailyActivity.userId, dailyActivity.day],
            set: { [counter]: sql`${dailyActivity[counter]} + 1`, updatedAt: sql`now()` },
          });
      });
    } catch (error) {
      // The account was deleted after the event was emitted; nothing left to project.
      if (isPgError(error, PG_ERROR.foreignKeyViolation)) return;
      throw error;
    }
  }
}
