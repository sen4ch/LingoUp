import { Inject, Injectable } from '@nestjs/common';
import type { CefrLevel } from '@lingoup/contracts';
import type { AppConfig } from '../../../config/app-config.js';
import { APP_CONFIG, DomainError } from '../../../platform/index.js';
import { AiQuota } from './ai-quota.js';
import { Semaphore } from './semaphore.js';

@Injectable()
export class ListeningAudioGateway {
  private readonly semaphore = new Semaphore(2);
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly quota: AiQuota,
  ) {}

  async synthesize(userId: string, text: string, level: CefrLevel) {
    if (!this.config.ai.serviceToken)
      throw new DomainError('AI_UNAVAILABLE', 'Narration is not configured');
    if (!(await this.quota.tryConsume(userId)))
      throw new DomainError('AI_UNAVAILABLE', 'Daily AI limit reached', {
        aiStatus: 'quota_exceeded',
      });
    const signal = AbortSignal.timeout(120_000);
    try {
      const release = await this.semaphore.acquire(signal);
      try {
        const response = await fetch(`${this.config.ai.serviceUrl}/v1/listening/audio`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-ai-service-token': this.config.ai.serviceToken,
          },
          body: JSON.stringify({
            text,
            level,
          }),
          signal,
        });
        if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/mpeg'))
          throw new Error('Narration failed');
        const durationSeconds = Number(response.headers.get('x-audio-duration'));
        if (!Number.isFinite(durationSeconds) || durationSeconds < 180 || durationSeconds > 300)
          throw new Error('Invalid duration');
        const data = Buffer.from(await response.arrayBuffer());
        if (!data.length || data.length > 4 * 1024 * 1024) throw new Error('Invalid audio size');
        return { data, durationSeconds };
      } finally {
        release();
      }
    } catch {
      throw new DomainError('AI_UNAVAILABLE', 'Could not create 3-5 minute audio', {
        aiStatus: 'unavailable',
      });
    }
  }
}
