import { Inject, Injectable } from '@nestjs/common';
import type {
  CefrLevel,
  GrammarAnswerResult,
  GrammarTopicDetail,
  GrammarTopicSummary,
} from '@lingoup/contracts';
import type { Database } from '@lingoup/database';
import {
  DATABASE,
  notFound,
  OutboxWriter,
  PersonalDataRegistry,
  type PersonalDataExporter,
} from '../../../platform/index.js';
import { isAcceptedAnswer } from '../domain/grammar-document.js';
import { GrammarRepository } from '../infrastructure/grammar.repository.js';

@Injectable()
export class GrammarService implements PersonalDataExporter {
  readonly section = 'grammar';

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly repository: GrammarRepository,
    private readonly outbox: OutboxWriter,
    personalData: PersonalDataRegistry,
  ) {
    personalData.register(this);
  }

  listTopics(level: CefrLevel | undefined, userId: string | null): Promise<GrammarTopicSummary[]> {
    return this.repository.listPublished(level, userId);
  }

  async getTopic(slug: string, userId: string | null): Promise<GrammarTopicDetail> {
    const topic = await this.repository.findPublishedBySlug(slug, userId);
    if (!topic) throw notFound('Grammar topic');
    return topic;
  }

  /** Checks an answer on the server (answers never reach the client) and records the attempt. */
  async submitAnswer(
    userId: string,
    exerciseId: string,
    answer: string,
  ): Promise<GrammarAnswerResult> {
    const exercise = await this.repository.findExerciseForGrading(exerciseId);
    if (!exercise) throw notFound('Exercise');
    const correct = isAcceptedAnswer(answer, exercise.answers);
    await this.db.transaction(async (tx) => {
      const attemptId = await this.repository.insertAttempt(tx, {
        userId,
        exerciseId,
        answer,
        correct,
      });
      await this.outbox.append(tx, {
        type: 'ExerciseCompleted',
        version: 1,
        userId,
        payload: { exerciseId, attemptId, correct, score: correct ? 1 : 0 },
      });
    });
    return {
      exerciseId,
      correct,
      correctAnswer: exercise.answers[0] ?? '',
      explanation: exercise.explanation,
    };
  }

  exportUserData(userId: string): Promise<unknown> {
    return this.repository.exportUser(userId);
  }
}
