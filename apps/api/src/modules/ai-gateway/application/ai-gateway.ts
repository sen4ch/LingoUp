import { setTimeout as sleep } from 'node:timers/promises';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AI_TASKS,
  AiServiceError,
  isIdempotentTask,
  taskDuration,
  type AiTaskInput,
  type AiTaskResult,
  type ImplementedAiTaskType,
} from '@lingoup/ai-sdk';
import type { AppConfig } from '../../../config/app-config.js';
import { APP_CONFIG } from '../../../platform/index.js';
import { AI_PROVIDER, type AIProvider } from './ai-provider.js';
import { AiQuota } from './ai-quota.js';
import { Semaphore } from './semaphore.js';

export type AiGatewayOutcome<T extends ImplementedAiTaskType> =
  | { status: 'ok'; result: AiTaskResult<T> }
  | {
      status: 'disabled' | 'not_supported' | 'consent_required' | 'quota_exceeded' | 'unavailable';
    };

export interface AiCallContext {
  userId: string;
  /** User consented to sending their content to external providers. */
  externalSharingConsent: boolean;
}

/**
 * Single entry point for AI tasks. Applies policy (privacy, quota), resilience
 * (deadline, bounded concurrency, retries for idempotent tasks) and validates output.
 * Failures are reported as outcomes, never thrown: AI is always optional.
 */
@Injectable()
export class AiGateway {
  private readonly logger = new Logger(AiGateway.name);
  private readonly semaphore: Semaphore;

  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AIProvider | null,
    private readonly quota: AiQuota,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.semaphore = new Semaphore(config.ai.maxConcurrency);
  }

  get enabled(): boolean {
    return this.provider !== null;
  }

  async run<T extends ImplementedAiTaskType>(
    task: T,
    input: AiTaskInput<T>,
    context: AiCallContext,
  ): Promise<AiGatewayOutcome<T>> {
    const provider = this.provider;
    if (!provider) return { status: 'disabled' };
    if (!provider.supports(task)) return { status: 'not_supported' };

    const parsedInput = AI_TASKS[task].input.safeParse(input);
    if (!parsedInput.success) {
      this.logger.warn({ task }, 'AI task input rejected by schema');
      return { status: 'unavailable' };
    }

    // One deadline covers waiting for a slot, every attempt and backoff.
    const deadline = AbortSignal.timeout(
      taskDuration(task) === 'generation'
        ? this.config.ai.generationTimeoutMs
        : this.config.ai.timeoutMs,
    );
    const startedAt = performance.now();
    try {
      const locality = await provider.dataLocality(deadline);
      if (locality === 'external') {
        if (!this.config.ai.allowExternal) return { status: 'disabled' };
        if (!context.externalSharingConsent) return { status: 'consent_required' };
      }
      if (!(await this.quota.tryConsume(context.userId))) return { status: 'quota_exceeded' };

      const release = await this.semaphore.acquire(deadline);
      try {
        const result = await this.executeWithRetry(
          provider,
          task,
          parsedInput.data as AiTaskInput<T>,
          deadline,
        );
        this.logger.log(
          {
            task,
            provider: result.provider,
            model: result.model,
            ms: Math.round(performance.now() - startedAt),
          },
          'AI task completed',
        );
        return { status: 'ok', result };
      } finally {
        release();
      }
    } catch (error) {
      // Never log task input: it contains user content.
      this.logger.warn(
        {
          task,
          provider: provider.name,
          timedOut: deadline.aborted,
          reason: error instanceof Error ? error.message : 'unknown',
          ms: Math.round(performance.now() - startedAt),
        },
        'AI task failed',
      );
      return { status: 'unavailable' };
    }
  }

  private async executeWithRetry<T extends ImplementedAiTaskType>(
    provider: AIProvider,
    task: T,
    input: AiTaskInput<T>,
    signal: AbortSignal,
  ): Promise<AiTaskResult<T>> {
    const maxAttempts = isIdempotentTask(task) ? 1 + this.config.ai.maxRetries : 1;
    for (let attempt = 1; ; attempt++) {
      try {
        const result = await provider.execute(task, input, signal);
        // Defence in depth: adapters validate too, but the gateway owns the contract.
        const output = AI_TASKS[task].output.parse(result.output);
        return { ...result, output } as AiTaskResult<T>;
      } catch (error) {
        const retryable = error instanceof AiServiceError && error.retryable;
        if (!retryable || attempt >= maxAttempts || signal.aborted) throw error;
        const backoffMs = 200 * 2 ** (attempt - 1) + Math.floor(Math.random() * 100);
        await sleep(backoffMs, undefined, { signal });
      }
    }
  }
}
