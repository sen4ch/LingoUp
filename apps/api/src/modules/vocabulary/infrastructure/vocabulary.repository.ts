import { Inject, Injectable } from '@nestjs/common';
import type { CardState, UpdateWordRequest, Word } from '@lingoup/contracts';
import type { Database, DbExecutor } from '@lingoup/database';
import { cards, reviewLogs, words } from '@lingoup/database/schema/vocabulary';
import type { CardSchedule } from '@lingoup/learning-engine';
import { and, asc, count, desc, eq, ilike, lt, lte, sql } from 'drizzle-orm';
import { DATABASE } from '../../../platform/index.js';

type WordRow = typeof words.$inferSelect;
type CardRow = typeof cards.$inferSelect;
type ReviewLogRow = typeof reviewLogs.$inferSelect;
export type NewReviewLog = typeof reviewLogs.$inferInsert;

export function toSchedule(card: CardRow): CardSchedule {
  return {
    state: card.state as CardState,
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduledDays,
    learningSteps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    lastReviewAt: card.lastReviewAt,
  };
}

export function toWordDto(word: WordRow, card: CardRow): Word {
  return {
    id: word.id,
    term: word.term,
    normalizedTerm: word.normalizedTerm,
    definition: word.definition,
    translation: word.translation,
    contextSentence: word.contextSentence,
    sourceTextSlug: word.sourceTextSlug,
    note: word.note,
    createdAt: word.createdAt.toISOString(),
    card: {
      id: card.id,
      state: card.state as CardState,
      due: card.due.toISOString(),
      reps: card.reps,
      lapses: card.lapses,
    },
  };
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/** Every query is scoped by user id: users can never reach each other's data. */
@Injectable()
export class VocabularyRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findWordIdByTerm(userId: string, normalizedTerm: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: words.id })
      .from(words)
      .where(and(eq(words.userId, userId), eq(words.normalizedTerm, normalizedTerm)));
    return row?.id ?? null;
  }

  async insertWordWithCard(
    tx: DbExecutor,
    word: Omit<typeof words.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>,
    schedule: CardSchedule,
  ): Promise<{ word: WordRow; card: CardRow }> {
    const [insertedWord] = await tx.insert(words).values(word).returning();
    const [insertedCard] = await tx
      .insert(cards)
      .values({ ...schedule, wordId: insertedWord!.id, userId: word.userId })
      .returning();
    return { word: insertedWord!, card: insertedCard! };
  }

  async findWord(
    userId: string,
    wordId: string,
  ): Promise<{ word: WordRow; card: CardRow } | undefined> {
    const [row] = await this.db
      .select({ word: words, card: cards })
      .from(words)
      .innerJoin(cards, eq(cards.wordId, words.id))
      .where(and(eq(words.userId, userId), eq(words.id, wordId)));
    return row;
  }

  async listWords(userId: string, options: { cursor?: string; limit: number; q?: string }) {
    return this.db
      .select({ word: words, card: cards })
      .from(words)
      .innerJoin(cards, eq(cards.wordId, words.id))
      .where(
        and(
          eq(words.userId, userId),
          options.cursor ? lt(words.id, options.cursor) : undefined,
          options.q
            ? ilike(words.normalizedTerm, `%${escapeLike(options.q.toLowerCase())}%`)
            : undefined,
        ),
      )
      .orderBy(desc(words.id))
      .limit(options.limit);
  }

  async updateWord(userId: string, wordId: string, patch: UpdateWordRequest): Promise<boolean> {
    // The patch comes from JSON, so present keys are set fields; an empty patch is a no-op.
    if (Object.keys(patch).length === 0) {
      return (await this.findWord(userId, wordId)) !== undefined;
    }
    const updated = await this.db
      .update(words)
      .set(patch)
      .where(and(eq(words.userId, userId), eq(words.id, wordId)))
      .returning({ id: words.id });
    return updated.length > 0;
  }

  async deleteWord(userId: string, wordId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(words)
      .where(and(eq(words.userId, userId), eq(words.id, wordId)))
      .returning({ id: words.id });
    return deleted.length > 0;
  }

  async dueCards(userId: string, now: Date, limit: number) {
    return this.db
      .select({ word: words, card: cards })
      .from(cards)
      .innerJoin(words, eq(words.id, cards.wordId))
      .where(and(eq(cards.userId, userId), lte(cards.due, now)))
      .orderBy(asc(cards.due))
      .limit(limit);
  }

  async countDue(userId: string, now: Date): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(cards)
      .where(and(eq(cards.userId, userId), lte(cards.due, now)));
    return row?.value ?? 0;
  }

  async findReviewLog(executor: DbExecutor, userId: string, clientReviewId: string) {
    const [row] = await executor
      .select()
      .from(reviewLogs)
      .where(and(eq(reviewLogs.userId, userId), eq(reviewLogs.clientReviewId, clientReviewId)));
    return row;
  }

  /** Locks the card row so concurrent reviews of the same card are serialized. */
  async lockCard(tx: DbExecutor, userId: string, cardId: string): Promise<CardRow | undefined> {
    const [row] = await tx
      .select()
      .from(cards)
      .where(and(eq(cards.userId, userId), eq(cards.id, cardId)))
      .for('update');
    return row;
  }

  async saveReview(
    tx: DbExecutor,
    cardId: string,
    schedule: CardSchedule,
    log: NewReviewLog,
  ): Promise<ReviewLogRow> {
    await tx.update(cards).set(schedule).where(eq(cards.id, cardId));
    const [inserted] = await tx.insert(reviewLogs).values(log).returning();
    return inserted!;
  }

  async stats(userId: string, now: Date) {
    const [byState, [due], [reviews]] = await Promise.all([
      this.db
        .select({ state: cards.state, value: count() })
        .from(cards)
        .where(eq(cards.userId, userId))
        .groupBy(cards.state),
      this.db
        .select({ value: count() })
        .from(cards)
        .where(and(eq(cards.userId, userId), lte(cards.due, now))),
      this.db.select({ value: count() }).from(reviewLogs).where(eq(reviewLogs.userId, userId)),
    ]);
    return { byState, dueNow: due?.value ?? 0, totalReviews: reviews?.value ?? 0 };
  }

  async exportUser(userId: string) {
    const [wordRows, logRows] = await Promise.all([
      this.db
        .select({ word: words, card: cards })
        .from(words)
        .innerJoin(cards, eq(cards.wordId, words.id))
        .where(eq(words.userId, userId))
        .orderBy(asc(words.id)),
      this.db
        .select({
          cardId: reviewLogs.cardId,
          rating: reviewLogs.rating,
          previousState: reviewLogs.previousState,
          nextState: reviewLogs.nextState,
          nextDue: reviewLogs.nextDue,
          durationMs: reviewLogs.durationMs,
          reviewedAt: reviewLogs.reviewedAt,
        })
        .from(reviewLogs)
        .where(eq(reviewLogs.userId, userId))
        .orderBy(asc(reviewLogs.reviewedAt), sql`${reviewLogs.id}`),
    ]);
    return {
      words: wordRows.map(({ word, card }) => toWordDto(word, card)),
      reviewLogs: logRows.map((log) => ({
        ...log,
        nextDue: log.nextDue.toISOString(),
        reviewedAt: log.reviewedAt.toISOString(),
      })),
    };
  }
}
