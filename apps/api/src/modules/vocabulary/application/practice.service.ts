import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type {
  AiLookupStatus,
  CompletePracticeRequest,
  PracticeItem,
  PracticeSet,
} from '@lingoup/contracts';
import type { Database } from '@lingoup/database';
import { normalizeTerm } from '@lingoup/learning-engine';
import { DATABASE, DomainError, notFound, OutboxWriter } from '../../../platform/index.js';
import { AiGateway, MOCK_PROVIDER_NAME } from '../../ai-gateway/index.js';
import { UserSettingsQuery } from '../../identity/index.js';
import {
  buildOptions,
  isUsableGeneratedSentence,
  itemsFromContext,
  MIN_PRACTICE_WORDS,
  type PracticeWord,
} from '../domain/practice.js';
import { VocabularyRepository } from '../infrastructure/vocabulary.repository.js';

const PRACTICE_SIZE = 8;

@Injectable()
export class PracticeService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly repository: VocabularyRepository,
    private readonly userSettings: UserSettingsQuery,
    private readonly ai: AiGateway,
    private readonly outbox: OutboxWriter,
  ) {}

  /** Public API for other modules: the words worth practising now. */
  async pickWords(userId: string, limit: number, now = new Date()): Promise<PracticeWord[]> {
    return this.repository.pickPracticeWords(userId, now, limit);
  }

  /** All vocabulary, or exactly the requested words; never substitute someone else's words. */
  async wordsForText(userId: string, wordIds?: string[]): Promise<PracticeWord[]> {
    const words = await this.repository.pickPracticeWords(userId, new Date(), undefined, wordIds);
    if (wordIds && words.length !== wordIds.length) throw notFound('Word');
    return words;
  }

  /**
   * Gap-fill exercises from the learner's own words. Sentences are written by the AI
   * gateway; without a usable answer from it, the learner's saved context sentences are used.
   */
  async createSet(userId: string, random: () => number = Math.random): Promise<PracticeSet> {
    const words = await this.pickWords(userId, PRACTICE_SIZE);
    if (words.length < MIN_PRACTICE_WORDS) {
      throw new DomainError(
        'NOT_ENOUGH_WORDS',
        `Save at least ${MIN_PRACTICE_WORDS} words to practise`,
        {
          required: MIN_PRACTICE_WORDS,
          saved: words.length,
        },
      );
    }
    const settings = await this.userSettings.getForUser(userId);
    const outcome = await this.ai.run(
      'exercise-generation',
      {
        level: settings.targetLevel,
        words: words.map(({ term, definition }) => ({ term, definition })),
      },
      { userId, externalSharingConsent: settings.aiDataSharing },
    );

    let aiStatus: AiLookupStatus = outcome.status === 'not_supported' ? 'disabled' : outcome.status;
    if (outcome.status === 'ok') {
      const byTerm = new Map(words.map((word) => [normalizeTerm(word.term), word]));
      const items: PracticeItem[] = [];
      for (const item of outcome.result.output.items) {
        const word = byTerm.get(normalizeTerm(item.term));
        if (!word || !isUsableGeneratedSentence(item.sentence, word.term)) continue;
        if (items.some((existing) => existing.wordId === word.wordId)) continue;
        items.push({
          wordId: word.wordId,
          term: word.term,
          sentence: item.sentence,
          hint: item.hint,
          options: buildOptions(word, words, random),
          answer: word.term,
        });
      }
      if (items.length >= MIN_PRACTICE_WORDS) {
        return {
          setId: randomUUID(),
          source: 'ai',
          provider: outcome.result.provider,
          isMock: outcome.result.provider === MOCK_PROVIDER_NAME,
          aiStatus: 'ok',
          items,
        };
      }
      aiStatus = 'unavailable';
    }

    const items = itemsFromContext(words, random);
    if (items.length === 0) {
      throw new DomainError(
        'AI_UNAVAILABLE',
        'AI is unavailable and your words have no saved example sentences',
        { aiStatus },
      );
    }
    return {
      setId: randomUUID(),
      source: 'context',
      provider: null,
      isMock: false,
      aiStatus,
      items,
    };
  }

  /** Records a finished practice set for progress tracking. */
  async complete(userId: string, request: CompletePracticeRequest): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.outbox.append(tx, {
        type: 'ExerciseCompleted',
        version: 1,
        userId,
        payload: {
          exerciseId: request.setId,
          attemptId: randomUUID(),
          correct: request.correct === request.total,
          score: request.correct / request.total,
        },
      });
    });
  }
}
