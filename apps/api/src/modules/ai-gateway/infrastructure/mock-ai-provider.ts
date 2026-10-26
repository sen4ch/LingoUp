import type { AiTaskInput, AiTaskResult, AiTaskType, ImplementedAiTaskType } from '@lingoup/ai-sdk';
import type { AIProvider, DataLocality } from '../application/ai-provider.js';

export const MOCK_PROVIDER_NAME = 'mock';

/**
 * Deterministic placeholder that lets the platform run without any model. Its output
 * is explicitly labelled as a placeholder (and flagged `isMock` in the API), it never
 * pretends to be a real explanation. Supports word-explanation only.
 */
export class MockAIProvider implements AIProvider {
  readonly name = MOCK_PROVIDER_NAME;

  dataLocality(): Promise<DataLocality> {
    return Promise.resolve('local');
  }

  supports(task: AiTaskType): boolean {
    return task === 'word-explanation';
  }

  execute<T extends ImplementedAiTaskType>(
    _task: T,
    input: AiTaskInput<T>,
    signal: AbortSignal,
  ): Promise<AiTaskResult<T>> {
    signal.throwIfAborted();
    const output = {
      definition: `Placeholder for "${input.term}": no language model is configured. Set AI_PROVIDER=ai-service to get real explanations.`,
      translation: null,
      partOfSpeech: null,
      example: input.context.trim() || null,
      usageNote: null,
    };
    return Promise.resolve({ provider: this.name, model: 'mock-v1', output } as AiTaskResult<T>);
  }
}
