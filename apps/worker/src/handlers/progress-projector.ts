import type { DomainEvent } from '@lingoup/contracts/events';
import { isPgError, PG_ERROR, type Database } from '@lingoup/database';
import { processedEvents } from '@lingoup/database/schema/platform';
import { dailyActivity, skillRewards } from '@lingoup/database/schema/progress';
import { sql } from 'drizzle-orm';
import type { EventHandler } from './event-handler.js';

type Counter = 'wordsSaved' | 'reviewsDone' | 'textsCompleted' | 'exercisesDone';

const COUNTER_BY_EVENT: Partial<Record<DomainEvent['type'], Counter>> = {
  WordSaved: 'wordsSaved',
  VocabularyReviewCompleted: 'reviewsDone',
  LessonCompleted: 'textsCompleted',
  ExerciseCompleted: 'exercisesDone',
  PracticeCompleted: 'exercisesDone',
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

        const reward = rewardForEvent(event);
        if (reward) {
          const inserted = await tx
            .insert(skillRewards)
            .values({ userId, ...reward, earnedAt: new Date(event.occurredAt) })
            .onConflictDoNothing()
            .returning({ skill: skillRewards.skill });
          // Duplicate practice submissions should not inflate daily activity either.
          if (event.type === 'PracticeCompleted' && inserted.length === 0) return;
        }

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

export function rewardForEvent(event: DomainEvent): { skill: string; sourceKey: string } | null {
  switch (event.type) {
    case 'LessonCompleted':
      return { skill: 'reading', sourceKey: event.payload.textId };
    case 'WordSaved':
      return { skill: 'vocabulary', sourceKey: `save:${event.payload.wordId}` };
    case 'VocabularyReviewCompleted':
      return event.payload.rating === 'again'
        ? null
        : {
            skill: 'vocabulary',
            sourceKey: `review:${event.payload.cardId}:${event.occurredAt.slice(0, 10)}`,
          };
    case 'ExerciseCompleted':
      return event.payload.correct
        ? { skill: 'grammar', sourceKey: `exercise:${event.payload.exerciseId}` }
        : null;
    case 'PracticeCompleted':
      return event.payload;
    default:
      return null;
  }
}
