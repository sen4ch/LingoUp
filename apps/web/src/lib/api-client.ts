import { ApiErrorSchema, type ErrorCode } from '@lingoup/contracts';
import type { z } from 'zod';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode | 'NETWORK_ERROR' | 'INVALID_RESPONSE',
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON-serialized, except a Blob/File, which is sent as-is with its own type (uploads). */
  body?: unknown;
  /** Response schema; responses are validated so contract drift fails loudly. */
  schema?: z.ZodType<T>;
  signal?: AbortSignal;
}

/**
 * Browser API client. Calls go to same-origin `/api/*`, which the Next.js server proxies
 * to the API, so the HttpOnly session cookie is sent automatically.
 */
export async function api<T = void>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers:
        options.body === undefined
          ? {}
          : {
              'content-type': options.body instanceof Blob ? options.body.type : 'application/json',
            },
      body:
        options.body === undefined
          ? null
          : options.body instanceof Blob
            ? options.body
            : JSON.stringify(options.body),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Network request failed');
  }

  const text = await response.text();
  const json: unknown = text ? safeJson(text) : null;

  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(json);
    if (parsed.success) {
      throw new ApiRequestError(
        response.status,
        parsed.data.error.code,
        parsed.data.error.message,
        parsed.data.error.details,
      );
    }
    throw new ApiRequestError(
      response.status,
      'INTERNAL_ERROR',
      `Request failed with ${response.status}`,
    );
  }
  if (!options.schema) return undefined as T;
  const parsed = options.schema.safeParse(json);
  if (!parsed.success)
    throw new ApiRequestError(response.status, 'INVALID_RESPONSE', 'Unexpected response format');
  return parsed.data;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const isUnauthenticated = (error: unknown) =>
  error instanceof ApiRequestError && error.status === 401;
