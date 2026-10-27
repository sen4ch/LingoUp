import { Injectable } from '@nestjs/common';
import type { PronunciationQuery } from '@lingoup/contracts';
import { DomainError } from '../../../platform/index.js';
import { SpeechGateway } from '../../ai-gateway/index.js';
import { UserSettingsQuery } from '../../identity/index.js';

const SPEECH_ERROR_MESSAGES: Record<string, string> = {
  disabled: 'Pronunciation audio is not configured',
  consent_required: 'Sending sentences to the external speech provider needs your consent',
  quota_exceeded: 'Daily AI limit reached',
  unavailable: 'The speech provider did not return audio',
};

/** Pronunciation of saved or looked-up words; the client falls back to the browser voice. */
@Injectable()
export class PronunciationService {
  constructor(
    private readonly speech: SpeechGateway,
    private readonly userSettings: UserSettingsQuery,
  ) {}

  async audio(userId: string, query: PronunciationQuery): Promise<Buffer> {
    const sensitive = query.kind === 'sentence';
    const consent = sensitive ? (await this.userSettings.getForUser(userId)).aiDataSharing : false;
    const outcome = await this.speech.synthesize({
      userId,
      text: query.text,
      sensitive,
      externalSharingConsent: consent,
    });
    if (outcome.status === 'ok') return outcome.audio;
    throw new DomainError('AI_UNAVAILABLE', SPEECH_ERROR_MESSAGES[outcome.status]!, {
      aiStatus: outcome.status,
    });
  }
}
