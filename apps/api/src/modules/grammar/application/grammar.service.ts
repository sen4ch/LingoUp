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
import { MistakeJournal } from '../../progress/index.js';

@Injectable()
export class GrammarService implements PersonalDataExporter {
  readonly section = 'grammar';

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly repository: GrammarRepository,
    private readonly outbox: OutboxWriter,
    private readonly journal: MistakeJournal,
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
      if (!correct)
        await this.journal.record(
          userId,
          {
            source: 'grammar',
            sourceKey: `${exercise.id}:${answer.trim().toLowerCase()}`,
            text: answer,
            context: `${exercise.topicTitle}: ${exercise.prompt}`,
            sourceHref: `/grammar/${exercise.topicSlug}`,
            issues: [
              {
                quote: answer,
                replacement: exercise.answers[0] ?? '',
                category: 'grammar',
                errorType: 'grammar_rule',
                explanation:
                  exercise.explanation ??
                  'Compare your answer with the accepted form and review the grammar rule.',
              },
            ],
          },
          tx,
        );
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
