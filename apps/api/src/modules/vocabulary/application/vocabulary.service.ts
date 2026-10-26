import { Inject, Injectable } from '@nestjs/common';
import type {
  AiExplanation,
  AiLookupStatus,
  ListWordsQuery,
  LookupRequest,
  LookupResponse,
  SaveWordRequest,
  UpdateWordRequest,
  Word,
  WordPage,
} from '@lingoup/contracts';
import { isPgError, PG_ERROR, type Database } from '@lingoup/database';
import { normalizeTerm, type SpacedRepetitionScheduler } from '@lingoup/learning-engine';
import {
  DATABASE,
  DomainError,
  notFound,
  OutboxWriter,
  PersonalDataRegistry,
  type PersonalDataExporter,
} from '../../../platform/index.js';
import { AiGateway, MOCK_PROVIDER_NAME } from '../../ai-gateway/index.js';
import { ContentQuery } from '../../content/index.js';
import { UserSettingsQuery } from '../../identity/index.js';
import { toWordDto, VocabularyRepository } from '../infrastructure/vocabulary.repository.js';
import { SCHEDULER } from './scheduler.provider.js';

function normalizeOrFail(term: string): string {
  const normalized = normalizeTerm(term);
  if (!normalized)
    throw new DomainError('VALIDATION_FAILED', 'Term must contain letters or digits');
  return normalized;
}

@Injectable()
export class VocabularyService implements PersonalDataExporter {
  readonly section = 'vocabulary';

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly repository: VocabularyRepository,
    private readonly outbox: OutboxWriter,
    private readonly content: ContentQuery,
    private readonly userSettings: UserSettingsQuery,
    private readonly ai: AiGateway,
    @Inject(SCHEDULER) private readonly scheduler: SpacedRepetitionScheduler,
    personalData: PersonalDataRegistry,
  ) {
    personalData.register(this);
  }

  /**
   * Builds the context card for a selected term. The curated glossary of the text is
   * preferred (works without AI); the AI gateway is asked only when the glossary has no entry.
   */
  async lookup(userId: string, request: LookupRequest): Promise<LookupResponse> {
    const normalizedTerm = normalizeOrFail(request.term);
    const [glossary, savedWordId] = await Promise.all([
      request.textSlug ? this.content.findGlossaryEntry(request.textSlug, normalizedTerm) : null,
      this.repository.findWordIdByTerm(userId, normalizedTerm),
    ]);

    let ai: AiExplanation | null = null;
    let aiStatus: AiLookupStatus = 'skipped';
    if (!glossary) {
      const settings = await this.userSettings.getForUser(userId);
      const outcome = await this.ai.run(
        'word-explanation',
        {
          term: request.term,
          context: request.context,
          learnerLevel: settings.targetLevel,
          nativeLanguage: settings.nativeLanguage,
        },
        { userId, externalSharingConsent: settings.aiDataSharing },
      );
      if (outcome.status === 'ok') {
        const { provider, model, output } = outcome.result;
        ai = { provider, model, isMock: provider === MOCK_PROVIDER_NAME, ...output };
        aiStatus = 'ok';
      } else {
        aiStatus = outcome.status === 'not_supported' ? 'disabled' : outcome.status;
      }
    }

    return { term: request.term, normalizedTerm, glossary, ai, aiStatus, savedWordId };
  }

  async saveWord(userId: string, request: SaveWordRequest): Promise<Word> {
    const normalizedTerm = normalizeOrFail(request.term);
    const sourceText = request.sourceTextSlug
      ? await this.content.findTextRef(request.sourceTextSlug)
      : null;
    const now = new Date();
    try {
      return await this.db.transaction(async (tx) => {
        const { word, card } = await this.repository.insertWordWithCard(
          tx,
          {
            userId,
            term: request.term,
            normalizedTerm,
            definition: request.definition ?? null,
            translation: request.translation ?? null,
            contextSentence: request.contextSentence ?? null,
            note: request.note ?? null,
            sourceTextId: sourceText?.id ?? null,
            sourceTextSlug: sourceText?.slug ?? null,
          },
          this.scheduler.createCard(now),
        );
        await this.outbox.append(tx, {
          type: 'WordSaved',
          version: 1,
          userId,
          payload: { wordId: word.id, cardId: card.id, sourceTextId: word.sourceTextId },
        });
        return toWordDto(word, card);
      });
    } catch (error) {
      if (isPgError(error, PG_ERROR.uniqueViolation, 'words_user_term_key')) {
        const existingId = await this.repository.findWordIdByTerm(userId, normalizedTerm);
        throw new DomainError('WORD_ALREADY_SAVED', 'This word is already in your vocabulary', {
          wordId: existingId,
        });
      }
      throw error;
    }
  }

  async listWords(userId: string, query: ListWordsQuery): Promise<WordPage> {
    const rows = await this.repository.listWords(userId, {
      limit: query.limit + 1,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.q ? { q: query.q } : {}),
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map(({ word, card }) => toWordDto(word, card)),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.word.id ?? null) : null,
    };
  }

  async getWord(userId: string, wordId: string): Promise<Word> {
    const row = await this.repository.findWord(userId, wordId);
    if (!row) throw notFound('Word');
    return toWordDto(row.word, row.card);
  }

  async updateWord(userId: string, wordId: string, patch: UpdateWordRequest): Promise<Word> {
    if (!(await this.repository.updateWord(userId, wordId, patch))) throw notFound('Word');
    return this.getWord(userId, wordId);
  }

  async deleteWord(userId: string, wordId: string): Promise<void> {
    if (!(await this.repository.deleteWord(userId, wordId))) throw notFound('Word');
  }

  exportUserData(userId: string): Promise<unknown> {
    return this.repository.exportUser(userId);
  }
}
