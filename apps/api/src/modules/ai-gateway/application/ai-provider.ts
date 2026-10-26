import type { AiTaskInput, AiTaskResult, AiTaskType, ImplementedAiTaskType } from '@lingoup/ai-sdk';

/**
 * Where user content goes when a provider runs a task.
 * - local: stays on infrastructure operated by this deployment.
 * - external: leaves it (third-party API). Requires admin opt-in and user consent.
 */
export type DataLocality = 'local' | 'external';

/** Port implemented by every AI adapter. The gateway never depends on concrete models. */
export interface AIProvider {
  readonly name: string;
  /** Resolved lazily for remote providers whose backend is configured elsewhere. */
  dataLocality(signal: AbortSignal): Promise<DataLocality>;
  supports(task: AiTaskType): boolean;
  execute<T extends ImplementedAiTaskType>(
    task: T,
    input: AiTaskInput<T>,
    signal: AbortSignal,
  ): Promise<AiTaskResult<T>>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
