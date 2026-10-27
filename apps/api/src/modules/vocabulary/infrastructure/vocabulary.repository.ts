import { Inject, Injectable } from '@nestjs/common';
import type { CardState, UpdateWordRequest, Word, WordImage } from '@lingoup/contracts';
import type { Database, DbExecutor } from '@lingoup/database';
import { cards, reviewLogs, wordImages, words } from '@lingoup/database/schema/vocabulary';
import type { CardSchedule } from '@lingoup/learning-engine';
import { and, asc, count, desc, eq, ilike, inArray, lt, lte, sql } from 'drizzle-orm';
import { DATABASE } from '../../../platform/index.js';

type WordRow = typeof words.$inferSelect;
type CardRow = typeof cards.$inferSelect;
type ReviewLogRow = typeof reviewLogs.$inferSelect;
export type NewReviewLog = typeof reviewLogs.$inferInsert;
export type NewWordImage = typeof wordImages.$inferInsert;

/** Image metadata only: the bytes are loaded separately, when the picture is requested. */
const imageColumns = {
  source: wordImages.source,
  title: wordImages.title,
  creator: wordImages.creator,
  license: wordImages.license,
  licenseUrl: wordImages.licenseUrl,
  landingUrl: wordImages.landingUrl,
  updatedAt: wordImages.updatedAt,
};
type ImageColumns = {
  [K in keyof typeof imageColumns]: (typeof imageColumns)[K]['_']['data'] | null;
};

export function toWordImage(image: ImageColumns | null | undefined): WordImage | null {
  if (!image?.source || !image.updatedAt) return null;
  return {
    source: image.source as WordImage['source'],
    title: image.title,
    creator: image.creator,
    license: image.license,
    licenseUrl: image.licenseUrl,
    landingUrl: image.landingUrl,
    updatedAt: image.updatedAt.toISOString(),
  };
}

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

export function toWordDto(word: WordRow, card: CardRow, image: WordImage | null = null): Word {
  return {
    id: word.id,
    term: word.term,
    normalizedTerm: word.normalizedTerm,
    definition: word.definition,
    translation: word.translation,
    contextSentence: word.contextSentence,
    sourceTextSlug: word.sourceTextSlug,
    note: word.note,
    image,
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
  ): Promise<{ word: WordRow; card: CardRow; image: ImageColumns | null } | undefined> {
    const [row] = await this.db
      .select({ word: words, card: cards, image: imageColumns })
      .from(words)
      .innerJoin(cards, eq(cards.wordId, words.id))
      .leftJoin(wordImages, eq(wordImages.wordId, words.id))
      .where(and(eq(words.userId, userId), eq(words.id, wordId)));
    return row;
  }

  async listWords(userId: string, options: { cursor?: string; limit: number; q?: string }) {
    return this.db
      .select({ word: words, card: cards, image: imageColumns })
      .from(words)
      .innerJoin(cards, eq(cards.wordId, words.id))
      .leftJoin(wordImages, eq(wordImages.wordId, words.id))
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

  /**
   * Words worth practising now: overdue cards first (most overdue first), then cards in
   * learning/relearning, then the newest words.
   */
  async pickPracticeWords(userId: string, now: Date, limit?: number, wordIds?: string[]) {
    const query = this.db
      .select({
        wordId: words.id,
        term: words.term,
        definition: words.definition,
        translation: words.translation,
        contextSentence: words.contextSentence,
      })
      .from(words)
      .innerJoin(cards, eq(cards.wordId, words.id))
      .where(and(eq(words.userId, userId), wordIds ? inArray(words.id, wordIds) : undefined))
      .orderBy(
        sql`CASE WHEN ${cards.due} <= ${now} THEN 0 WHEN ${cards.state} IN ('learning', 'relearning') THEN 1 ELSE 2 END`,
        asc(cards.due),
        desc(words.id),
      );
    return limit === undefined ? query : query.limit(limit);
  }

  async dueCards(userId: string, now: Date, limit: number) {
    return this.db
      .select({ word: words, card: cards, image: imageColumns })
      .from(cards)
      .innerJoin(words, eq(words.id, cards.wordId))
      .leftJoin(wordImages, eq(wordImages.wordId, words.id))
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

  async findImageData(userId: string, wordId: string) {
    const [row] = await this.db
      .select({
        data: wordImages.data,
        mimeType: wordImages.mimeType,
        updatedAt: wordImages.updatedAt,
      })
      .from(wordImages)
      .where(and(eq(wordImages.userId, userId), eq(wordImages.wordId, wordId)));
    return row;
  }

  /** Inserts or replaces the picture of a word; returns its metadata. */
  async upsertImage(image: NewWordImage): Promise<WordImage> {
    const now = new Date();
    const [row] = await this.db
      .insert(wordImages)
      .values({ ...image, updatedAt: now })
      .onConflictDoUpdate({
        target: wordImages.wordId,
        set: { ...image, createdAt: undefined, updatedAt: now },
      })
      .returning(imageColumns);
    return toWordImage(row)!;
  }

  async deleteImage(userId: string, wordId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(wordImages)
      .where(and(eq(wordImages.userId, userId), eq(wordImages.wordId, wordId)))
      .returning({ wordId: wordImages.wordId });
    return deleted.length > 0;
  }

  async exportUser(userId: string) {
    const [wordRows, logRows, imageRows] = await Promise.all([
      this.db
        .select({ word: words, card: cards, image: imageColumns })
        .from(words)
        .innerJoin(cards, eq(cards.wordId, words.id))
        .leftJoin(wordImages, eq(wordImages.wordId, words.id))
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
      this.db
        .select({ wordId: wordImages.wordId, mimeType: wordImages.mimeType, data: wordImages.data })
        .from(wordImages)
        .where(eq(wordImages.userId, userId))
        .orderBy(asc(wordImages.wordId)),
    ]);
    return {
      words: wordRows.map(({ word, card, image }) => toWordDto(word, card, toWordImage(image))),
      // Pictures are personal data too (uploads in particular): exported as data URLs.
      images: imageRows.map(({ wordId, mimeType, data }) => ({
        wordId,
        dataUrl: `data:${mimeType};base64,${data.toString('base64')}`,
      })),
      reviewLogs: logRows.map((log) => ({
        ...log,
        nextDue: log.nextDue.toISOString(),
        reviewedAt: log.reviewedAt.toISOString(),
      })),
    };
  }
}
