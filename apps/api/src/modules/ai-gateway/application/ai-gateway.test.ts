import { AiServiceError, type AiTaskType } from '@lingoup/ai-sdk';
import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../../config/app-config.js';
import { MockAIProvider } from '../infrastructure/mock-ai-provider.js';
import { AiGateway } from './ai-gateway.js';
import type { AIProvider, DataLocality } from './ai-provider.js';
import type { AiQuota } from './ai-quota.js';
import { Semaphore } from './semaphore.js';

const input = {
  term: 'thrive',
  context: 'Plants thrive in sun.',
  learnerLevel: 'B1',
  nativeLanguage: 'ru',
} as const;
const consent = { userId: 'u1', externalSharingConsent: true };
const validOutput = {
  definition: 'to grow well',
  translation: 'процветать',
  partOfSpeech: 'verb',
  example: null,
  usageNote: null,
};

function makeConfig(overrides: Partial<AppConfig['ai']> = {}): AppConfig {
  return {
    ai: {
      provider: 'ai-service',
      serviceUrl: 'http://ai',
      serviceToken: 'x'.repeat(32),
      timeoutMs: 1000,
      maxConcurrency: 2,
      maxRetries: 1,
      dailyQuotaPerUser: 10,
      allowExternal: true,
      ...overrides,
    },
  } as AppConfig;
}

function fakeProvider(
  execute: AIProvider['execute'],
  locality: DataLocality = 'local',
): AIProvider {
  return {
    name: 'fake',
    dataLocality: () => Promise.resolve(locality),
    supports: (task: AiTaskType) => task === 'word-explanation',
    execute,
  };
}

const quotaAllowing = (allowed = true) =>
  ({ tryConsume: vi.fn().mockResolvedValue(allowed) }) as unknown as AiQuota;

describe('AiGateway', () => {
  it('returns disabled when no provider is configured', async () => {
    const gateway = new AiGateway(null, quotaAllowing(), makeConfig());
    await expect(gateway.run('word-explanation', input, consent)).resolves.toEqual({
      status: 'disabled',
    });
  });

  it('runs the mock provider and labels the result', async () => {
    const gateway = new AiGateway(new MockAIProvider(), quotaAllowing(), makeConfig());
    const outcome = await gateway.run('word-explanation', input, consent);
    expect(outcome.status).toBe('ok');
    if (outcome.status === 'ok') {
      expect(outcome.result.provider).toBe('mock');
      expect(outcome.result.output.example).toBe(input.context);
    }
  });

  it('retries retryable failures of idempotent tasks', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new AiServiceError('busy', 503, true))
      .mockResolvedValueOnce({ provider: 'fake', model: 'm', output: validOutput });
    const gateway = new AiGateway(fakeProvider(execute), quotaAllowing(), makeConfig());
    const outcome = await gateway.run('word-explanation', input, consent);
    expect(outcome.status).toBe('ok');
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable failures', async () => {
    const execute = vi.fn().mockRejectedValue(new AiServiceError('bad request', 422, false));
    const gateway = new AiGateway(fakeProvider(execute), quotaAllowing(), makeConfig());
    await expect(gateway.run('word-explanation', input, consent)).resolves.toEqual({
      status: 'unavailable',
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rejects provider output that violates the task schema', async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ provider: 'fake', model: 'm', output: { definition: 42 } });
    const gateway = new AiGateway(
      fakeProvider(execute),
      quotaAllowing(),
      makeConfig({ maxRetries: 0 }),
    );
    await expect(gateway.run('word-explanation', input, consent)).resolves.toEqual({
      status: 'unavailable',
    });
  });

  it('enforces the deadline', async () => {
    const execute = vi.fn(
      (_task: unknown, _input: unknown, signal: AbortSignal) =>
        new Promise<never>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(signal.reason as Error);
          });
        }),
    );
    const gateway = new AiGateway(
      fakeProvider(execute),
      quotaAllowing(),
      makeConfig({ timeoutMs: 50 }),
    );
    await expect(gateway.run('word-explanation', input, consent)).resolves.toEqual({
      status: 'unavailable',
    });
  });

  it('never sends content to external providers without admin opt-in and user consent', async () => {
    const execute = vi.fn();
    const external = fakeProvider(execute, 'external');
    const notAllowed = new AiGateway(
      external,
      quotaAllowing(),
      makeConfig({ allowExternal: false }),
    );
    const noConsent = new AiGateway(external, quotaAllowing(), makeConfig({ allowExternal: true }));

    await expect(notAllowed.run('word-explanation', input, consent)).resolves.toEqual({
      status: 'disabled',
    });
    await expect(
      noConsent.run('word-explanation', input, { userId: 'u1', externalSharingConsent: false }),
    ).resolves.toEqual({ status: 'consent_required' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('stops at the daily quota', async () => {
    const execute = vi.fn();
    const gateway = new AiGateway(fakeProvider(execute), quotaAllowing(false), makeConfig());
    await expect(gateway.run('word-explanation', input, consent)).resolves.toEqual({
      status: 'quota_exceeded',
    });
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('Semaphore', () => {
  it('limits concurrency and hands slots to waiters in order', async () => {
    const semaphore = new Semaphore(1);
    const signal = new AbortController().signal;
    const release = await semaphore.acquire(signal);
    const second = semaphore.acquire(signal);
    expect(semaphore.pending).toBe(1);
    release();
    const releaseSecond = await second;
    expect(semaphore.pending).toBe(0);
    releaseSecond();
  });

  it('removes aborted waiters', async () => {
    const semaphore = new Semaphore(1);
    await semaphore.acquire(new AbortController().signal);
    const controller = new AbortController();
    const waiting = semaphore.acquire(controller.signal);
    controller.abort(new Error('timeout'));
    await expect(waiting).rejects.toThrow('timeout');
    expect(semaphore.pending).toBe(0);
  });
});
