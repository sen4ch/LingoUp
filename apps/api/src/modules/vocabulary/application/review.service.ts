import { Inject, Injectable } from '@nestjs/common';
import type {
  CardState,
  DueReviewsResponse,
  SubmitReviewRequest,
  SubmitReviewResponse,
} from '@lingoup/contracts';
import { isPgError, PG_ERROR, type Database } from '@lingoup/database';
import type { SpacedRepetitionScheduler } from '@lingoup/learning-engine';
import { DATABASE, notFound, OutboxWriter } from '../../../platform/index.js';
import {
  toSchedule,
  toWordImage,
  VocabularyRepository,
} from '../infrastructure/vocabulary.repository.js';
import { SCHEDULER } from './scheduler.provider.js';

type ReviewLogRow = NonNullable<Awaited<ReturnType<VocabularyRepository['findReviewLog']>>>;

function duplicateResponse(log: ReviewLogRow): SubmitReviewResponse {
  return {
    cardId: log.cardId,
    state: log.nextState as CardState,
    due: log.nextDue.toISOString(),
    reviewedAt: log.reviewedAt.toISOString(),
    duplicate: true,
  };
}

@Injectable()
export class ReviewService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly repository: VocabularyRepository,
    private readonly outbox: OutboxWriter,
    @Inject(SCHEDULER) private readonly scheduler: SpacedRepetitionScheduler,
  ) {}

  async dueCards(userId: string, limit: number, now = new Date()): Promise<DueReviewsResponse> {
    const [rows, totalDue] = await Promise.all([
      this.repository.dueCards(userId, now, limit),
      this.repository.countDue(userId, now),
    ]);
    return {
      totalDue,
      cards: rows.map(({ word, card, image }) => {
        const preview = this.scheduler.preview(toSchedule(card), now);
        return {
          cardId: card.id,
          wordId: word.id,
          term: word.term,
          definition: word.definition,
          translation: word.translation,
          contextSentence: word.contextSentence,
          image: toWordImage(image),
          state: card.state as CardState,
          due: card.due.toISOString(),
          nextDue: {
            again: preview.again.toISOString(),
            hard: preview.hard.toISOString(),
            good: preview.good.toISOString(),
            easy: preview.easy.toISOString(),
          },
        };
      }),
    };
  }

  /**
   * Applies a rating with FSRS. Idempotent per `clientReviewId`: a retried request
   * (network failure, double click) returns the original result instead of reviewing twice.
   */
  async submit(
    userId: string,
    request: SubmitReviewRequest,
    now = new Date(),
  ): Promise<SubmitReviewResponse> {
    try {
      return await this.db.transaction(async (tx) => {
        const previous = await this.repository.findReviewLog(tx, userId, request.clientReviewId);
        if (previous) return duplicateResponse(previous);

        const card = await this.repository.lockCard(tx, userId, request.cardId);
        if (!card) throw notFound('Card');

        const outcome = this.scheduler.review(toSchedule(card), request.rating, now);
        const log = await this.repository.saveReview(tx, card.id, outcome.card, {
          cardId: card.id,
          userId,
          clientReviewId: request.clientReviewId,
          rating: request.rating,
          previousState: outcome.log.previousState,
          nextState: outcome.card.state,
          previousDue: outcome.log.previousDue,
          nextDue: outcome.card.due,
          stability: outcome.log.stability,
          difficulty: outcome.log.difficulty,
          scheduledDays: outcome.log.scheduledDays,
          durationMs: request.durationMs ?? null,
          reviewedAt: now,
        });
        await this.outbox.append(
          tx,
          {
            type: 'VocabularyReviewCompleted',
            version: 1,
            userId,
            payload: {
              cardId: card.id,
              reviewLogId: log.id,
              rating: request.rating,
              previousState: outcome.log.previousState,
              nextState: outcome.card.state,
              nextDue: outcome.card.due.toISOString(),
            },
          },
          now,
        );
        return {
          cardId: card.id,
          state: outcome.card.state,
          due: outcome.card.due.toISOString(),
          reviewedAt: now.toISOString(),
          duplicate: false,
        };
      });
    } catch (error) {
      // Two concurrent requests with the same clientReviewId: the loser reads the winner's result.
      if (isPgError(error, PG_ERROR.uniqueViolation, 'review_logs_user_client_review_key')) {
        const winner = await this.repository.findReviewLog(this.db, userId, request.clientReviewId);
        if (winner) return duplicateResponse(winner);
      }
      throw error;
    }
  }
}
