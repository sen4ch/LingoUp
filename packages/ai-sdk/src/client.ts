import { z } from 'zod';
import {
  AI_TASKS,
  type AiTaskInput,
  type AiTaskOutput,
  type AiTaskResult,
  type ImplementedAiTaskType,
} from './tasks.js';

export class AiServiceError extends Error {
  constructor(
    message: string,
    /** HTTP status, or null for network-level failures. */
    public readonly status: number | null,
    /** Whether repeating the same request may succeed. */
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'AiServiceError';
  }
}

const TaskResponseSchema = z.object({
  provider: z.string(),
  model: z.string(),
  output: z.unknown(),
});

const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  provider: z.string(),
  model: z.string(),
  dataLocality: z.enum(['local', 'external']),
});
export type AiServiceHealth = z.infer<typeof HealthResponseSchema>;

export interface AiServiceClientOptions {
  baseUrl: string;
  /** Shared secret; ai-service rejects requests without it. */
  token: string;
  fetch?: typeof fetch;
}

/** Minimal typed client for apps/ai-service. Timeouts are controlled by the caller's signal. */
export class AiServiceClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: AiServiceClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetch ?? fetch;
  }

  async health(signal?: AbortSignal): Promise<AiServiceHealth> {
    const body = await this.request('GET', '/health', undefined, signal);
    return HealthResponseSchema.parse(body);
  }

  async runTask<T extends ImplementedAiTaskType>(
    task: T,
    input: AiTaskInput<T>,
    signal?: AbortSignal,
  ): Promise<AiTaskResult<T>> {
    const body = TaskResponseSchema.parse(
      await this.request('POST', `/v1/tasks/${task}`, input, signal),
    );
    const output = AI_TASKS[task].output.safeParse(body.output);
    if (!output.success) {
      throw new AiServiceError(
        'AI service returned output that does not match the schema',
        200,
        true,
      );
    }
    return { provider: body.provider, model: body.model, output: output.data as AiTaskOutput<T> };
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    payload: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          'x-ai-service-token': this.options.token,
        },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
        ...(signal ? { signal } : {}),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new AiServiceError(
        `AI service is unreachable: ${(error as Error).message}`,
        null,
        true,
      );
    }
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw new AiServiceError(
        `AI service responded with ${response.status}`,
        response.status,
        retryable,
      );
    }
    return response.json();
  }
}
