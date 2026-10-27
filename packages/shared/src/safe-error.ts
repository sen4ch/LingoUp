/**
 * Log-safe view of an error. Drizzle errors embed the failed SQL and its bound values
 * ("params: ...") in the message, and bound values may be personal data or password hashes.
 * Values are dropped; the SQL text, the PostgreSQL error code and the stack are kept.
 */
export interface SafeError {
  type: string;
  message: string;
  code?: string;
  constraint?: string;
  stack?: string;
  cause?: SafeError;
}

const stripParams = (text: string) =>
  text.replace(/\nparams:[\s\S]*?(?=\n {4}at |$)/g, '\nparams: [redacted]');

export function toSafeError(error: unknown, depth = 0): SafeError {
  if (!(error instanceof Error)) return { type: typeof error, message: 'Non-error value thrown' };
  const details = error as Error & { code?: unknown; constraint?: unknown };
  return {
    type: error.name,
    message: stripParams(error.message),
    ...(typeof details.code === 'string' ? { code: details.code } : {}),
    ...(typeof details.constraint === 'string' ? { constraint: details.constraint } : {}),
    ...(error.stack ? { stack: stripParams(error.stack) } : {}),
    ...(error.cause !== undefined && depth < 3
      ? { cause: toSafeError(error.cause, depth + 1) }
      : {}),
  };
}
