import { Injectable } from '@nestjs/common';
import type { GenerateTextRequest, GenerateTextResponse } from '@lingoup/contracts';
import { findTermOccurrences, normalizeTerm, tokenize } from '@lingoup/learning-engine';
import { DomainError } from '../../../platform/index.js';
import { AiGateway, MOCK_PROVIDER_NAME } from '../../ai-gateway/index.js';
import { PrivateTextsService } from '../../content/index.js';
import { UserSettingsQuery } from '../../identity/index.js';
import { MIN_PRACTICE_WORDS, PracticeService } from '../../vocabulary/index.js';

const AI_ERROR_MESSAGES: Record<string, string> = {
  disabled: 'AI is not configured on this server',
  consent_required: 'The AI provider is external; allow AI data sharing in your settings first',
  quota_exceeded: 'Daily AI limit reached',
  unavailable: 'The AI provider did not return a usable text',
};

/** Requested terms the text does not contain, allowing regular inflections (improve → improved). */
export function findMissingTerms(
  paragraphs: readonly string[],
  terms: readonly string[],
): string[] {
  const words = tokenize(paragraphs.join(' '))
    .filter((token) => token.isWord)
    .map((token) => normalizeTerm(token.text));
  return terms.filter((term) => findTermOccurrences(words, term).length === 0);
}

/**
 * Builds a private reading text around the words the learner is studying. Words are chosen
 * from the entire vocabulary or explicitly selected by the learner. Runs through the AI gateway with the
 * long "generation" timeout; see ADR-0008.
 */
@Injectable()
export class TextGenerationService {
  constructor(
    private readonly practice: PracticeService,
    private readonly userSettings: UserSettingsQuery,
    private readonly ai: AiGateway,
    private readonly privateTexts: PrivateTextsService,
  ) {}

  async generate(userId: string, request: GenerateTextRequest): Promise<GenerateTextResponse> {
    const words = await this.practice.wordsForText(userId, request.wordIds);
    if (words.length < MIN_PRACTICE_WORDS) {
      throw new DomainError('NOT_ENOUGH_WORDS', `Save at least ${MIN_PRACTICE_WORDS} words first`, {
        required: MIN_PRACTICE_WORDS,
        saved: words.length,
      });
    }
    const settings = await this.userSettings.getForUser(userId);
    const level = request.level ?? settings.targetLevel;
    const terms = words.map((word) => word.term);

    const outcome = await this.ai.run(
      'reading-text-generation',
      { level, words: terms, topic: request.topic ?? null },
      { userId, externalSharingConsent: settings.aiDataSharing },
    );
    if (outcome.status !== 'ok') {
      const status = outcome.status === 'not_supported' ? 'disabled' : outcome.status;
      throw new DomainError('AI_UNAVAILABLE', AI_ERROR_MESSAGES[status] ?? 'AI is unavailable', {
        aiStatus: status,
      });
    }

    const { provider, output } = outcome.result;
    const { slug } = await this.privateTexts.createGenerated({
      ownerUserId: userId,
      level,
      title: output.title,
      summary: output.summary,
      paragraphs: output.paragraphs,
      focusTerms: terms,
    });
    return {
      slug,
      title: output.title,
      focusTerms: terms,
      missingTerms: findMissingTerms(output.paragraphs, terms),
      provider,
      isMock: provider === MOCK_PROVIDER_NAME,
    };
  }
}
