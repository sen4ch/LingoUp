import type { ErrorCode } from '@lingoup/contracts';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  EMAIL_ALREADY_REGISTERED: 409,
  WORD_ALREADY_SAVED: 409,
  NOT_ENOUGH_WORDS: 422,
  AI_UNAVAILABLE: 503,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/**
 * Expected business error. Thrown by application services; translated to the public
 * error contract by the global exception filter. The message is shown to clients, so it
 * must not contain personal data or internals.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }

  get status(): number {
    return STATUS_BY_CODE[this.code];
  }
}

export const notFound = (what: string) => new DomainError('NOT_FOUND', `${what} not found`);
