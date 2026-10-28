import { Inject, Injectable } from '@nestjs/common';
import { TranscriptionResponseSchema } from '@lingoup/contracts';
import type { AppConfig } from '../../../config/app-config.js';
import { APP_CONFIG, DomainError } from '../../../platform/index.js';
import { AiQuota } from './ai-quota.js';
import { Semaphore } from './semaphore.js';

/** Local-only audio recognition: the internal service never forwards recordings to an LLM. */
@Injectable()
export class RecognitionGateway {
  private readonly semaphore = new Semaphore(2);
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly quota: AiQuota,
  ) {}

  async transcribe(userId: string, data: Buffer): Promise<{ text: string }> {
    if (!this.config.ai.serviceToken || !this.config.speaking.enabled)
      throw new DomainError('AI_UNAVAILABLE', 'Speech recognition is disabled', {
        aiStatus: 'disabled',
      });
    if (!(await this.quota.tryConsume(userId)))
      throw new DomainError('AI_UNAVAILABLE', 'Daily AI limit reached', {
        aiStatus: 'quota_exceeded',
      });
    const signal = AbortSignal.timeout(120_000);
    try {
      const release = await this.semaphore.acquire(signal);
      try {
        const response = await fetch(`${this.config.ai.serviceUrl}/v1/speaking/transcribe`, {
          method: 'POST',
          headers: {
            'content-type': 'audio/wav',
            'x-ai-service-token': this.config.ai.serviceToken,
          },
          body: new Uint8Array(data),
          signal,
        });
        if (response.status === 422)
          throw new DomainError('VALIDATION_FAILED', 'Invalid audio recording');
        if (!response.ok) throw new Error('Recognition unavailable');
        return TranscriptionResponseSchema.parse(await response.json());
      } finally {
        release();
      }
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError('AI_UNAVAILABLE', 'Speech recognition unavailable', {
        aiStatus: 'unavailable',
      });
    }
  }
}
