import {
  AiServiceClient,
  isImplementedTask,
  type AiTaskInput,
  type AiTaskResult,
  type AiTaskType,
  type ImplementedAiTaskType,
} from '@lingoup/ai-sdk';
import type { AIProvider, DataLocality } from '../application/ai-provider.js';

const LOCALITY_CACHE_MS = 60_000;

/** Adapter for apps/ai-service, which in turn routes to Ollama, vLLM or an OpenAI-compatible API. */
export class AiServiceProvider implements AIProvider {
  readonly name = 'ai-service';
  private locality: { value: DataLocality; expiresAt: number } | null = null;

  constructor(private readonly client: AiServiceClient) {}

  /**
   * The ai-service reports whether its configured backend is local or external.
   * Until it answers, the provider is unusable (fail closed, never assume "local").
   */
  async dataLocality(signal: AbortSignal): Promise<DataLocality> {
    if (this.locality && this.locality.expiresAt > Date.now()) return this.locality.value;
    const health = await this.client.health(signal);
    this.locality = { value: health.dataLocality, expiresAt: Date.now() + LOCALITY_CACHE_MS };
    return health.dataLocality;
  }

  supports(task: AiTaskType): boolean {
    return isImplementedTask(task);
  }

  execute<T extends ImplementedAiTaskType>(
    task: T,
    input: AiTaskInput<T>,
    signal: AbortSignal,
  ): Promise<AiTaskResult<T>> {
    return this.client.runTask(task, input, signal);
  }
}
