import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { AppConfig } from '../../../config/app-config.js';
import { APP_CONFIG, VALKEY } from '../../../platform/index.js';
import { AiQuota } from './ai-quota.js';
import { Semaphore } from './semaphore.js';
import { SPEECH_PROVIDER, type SpeechProvider } from './speech-provider.js';

/** Larger responses are treated as broken: a sentence of 600 characters is ~150 KB. */
const MAX_AUDIO_BYTES = 1024 * 1024;

export type SpeechOutcome =
  | { status: 'ok'; audio: Buffer; cached: boolean }
  | { status: 'disabled' | 'consent_required' | 'quota_exceeded' | 'unavailable' };

export interface SpeechRequest {
  userId: string;
  text: string;
  /**
   * Text that may reveal the learner's own content (a sentence from a private text).
   * It goes to an external provider only with consent; a single dictionary term does not.
   */
  sensitive: boolean;
  externalSharingConsent: boolean;
}

/**
 * Pronunciation audio with the same policy as AI tasks: privacy, daily quota, deadline and
 * bounded concurrency. Audio is cached in Valkey per voice and text, so a word is sent to
 * the provider once, and cache hits do not consume quota.
 */
@Injectable()
export class SpeechGateway {
  private readonly logger = new Logger(SpeechGateway.name);
  private readonly semaphore: Semaphore;

  constructor(
    @Inject(SPEECH_PROVIDER) private readonly provider: SpeechProvider | null,
    @Inject(VALKEY) private readonly valkey: Redis,
    private readonly quota: AiQuota,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.semaphore = new Semaphore(config.ai.maxConcurrency);
  }

  async synthesize(request: SpeechRequest): Promise<SpeechOutcome> {
    const provider = this.provider;
    if (!provider) return { status: 'disabled' };
    if (
      provider.dataLocality === 'external' &&
      request.sensitive &&
      !request.externalSharingConsent
    )
      return { status: 'consent_required' };

    const text = request.text.trim().replace(/\s+/g, ' ');
    const key = `speech:v1:${provider.name}:${provider.voice}:${createHash('sha256').update(text).digest('hex')}`;
    const deadline = AbortSignal.timeout(this.config.ai.timeoutMs);
    const startedAt = performance.now();
    try {
      const cached = await this.valkey.getBuffer(key);
      if (cached) return { status: 'ok', audio: cached, cached: true };
      if (!(await this.quota.tryConsume(request.userId))) return { status: 'quota_exceeded' };

      const release = await this.semaphore.acquire(deadline);
      let audio: Buffer;
      try {
        audio = await provider.synthesize(text, deadline);
      } finally {
        release();
      }
      if (audio.length === 0 || audio.length > MAX_AUDIO_BYTES)
        throw new Error(`Unexpected audio size: ${audio.length} bytes`);
      await this.valkey.set(key, audio, 'EX', this.config.speech.cacheTtlSeconds);
      this.logger.log(
        {
          provider: provider.name,
          bytes: audio.length,
          ms: Math.round(performance.now() - startedAt),
        },
        'Speech synthesized',
      );
      return { status: 'ok', audio, cached: false };
    } catch (error) {
      // Never log the text: it may come from the learner's own content.
      this.logger.warn(
        {
          provider: provider.name,
          timedOut: deadline.aborted,
          reason: error instanceof Error ? error.message : 'unknown',
        },
        'Speech synthesis failed',
      );
      return { status: 'unavailable' };
    }
  }
}
