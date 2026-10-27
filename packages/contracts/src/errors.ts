import { z } from 'zod';

export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'INVALID_CREDENTIALS',
  'EMAIL_ALREADY_REGISTERED',
  'WORD_ALREADY_SAVED',
  /** The learner needs more saved words for a practice text or exercise. */
  'NOT_ENOUGH_WORDS',
  /** A feature that requires a language model could not get an answer from it. */
  'AI_UNAVAILABLE',
  /** An uploaded or downloaded picture is not a supported, readable image. */
  'IMAGE_INVALID',
  /** Image search is disabled on this server or its provider did not answer. */
  'IMAGE_SEARCH_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;
export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
