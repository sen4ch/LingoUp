import { z } from 'zod';

export class EnvValidationError extends Error {
  constructor(public readonly issues: readonly string[]) {
    super(`Invalid environment configuration:\n  - ${issues.join('\n  - ')}`);
    this.name = 'EnvValidationError';
  }
}

/**
 * Parses process environment with a Zod schema and fails fast with a readable
 * message. Secret values are never echoed back, only variable names.
 */
export function loadEnv<TSchema extends z.ZodType>(
  schema: TSchema,
  source: Record<string, string | undefined> = process.env,
): z.infer<TSchema> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  return result.data;
}

/** Marker used by every placeholder secret in .env.example. */
const PLACEHOLDER_MARKER = 'change-me';

/**
 * Refuses to run in production with placeholder secrets copied from .env.example.
 * Only variable names are reported, never values.
 */
export function assertNoPlaceholderSecrets(
  nodeEnv: string | undefined,
  values: Record<string, string | null | undefined>,
): void {
  if (nodeEnv !== 'production') return;
  const offenders = Object.entries(values)
    .filter(([, value]) => value?.toLowerCase().includes(PLACEHOLDER_MARKER))
    .map(([name]) => `${name}: replace the "${PLACEHOLDER_MARKER}" placeholder from .env.example`);
  if (offenders.length > 0) throw new EnvValidationError(offenders);
}
