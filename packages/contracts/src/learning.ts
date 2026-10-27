import { z } from 'zod';
import { CefrLevelSchema, IsoDateTimeSchema, UuidSchema } from './common.js';
import { SlugSchema, TextSummarySchema } from './content.js';

export const ReadingCompletionSchema = z.object({
  textSlug: z.string(),
  completedAt: IsoDateTimeSchema,
});
export type ReadingCompletion = z.infer<typeof ReadingCompletionSchema>;

export const ReadingCompletionsResponseSchema = z.object({
  items: z.array(ReadingCompletionSchema),
});
export type ReadingCompletionsResponse = z.infer<typeof ReadingCompletionsResponseSchema>;

/** Generate a private reading text from the learner's own vocabulary. */
export const GenerateTextRequestSchema = z.object({
  /** Defaults to the learner's target level. */
  level: CefrLevelSchema.optional(),
  topic: z.string().trim().min(1).max(80).optional(),
  /** Omit to use the entire vocabulary; otherwise use exactly these owned words. */
  wordIds: z
    .array(UuidSchema)
    .min(3)
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate word ids')
    .optional(),
});
export type GenerateTextRequest = z.infer<typeof GenerateTextRequestSchema>;

export const GenerateTextResponseSchema = z.object({
  slug: SlugSchema,
  title: z.string(),
  /** Vocabulary terms that were requested from the model. */
  focusTerms: z.array(z.string()),
  /** Requested terms that the generated text does not actually contain. */
  missingTerms: z.array(z.string()),
  provider: z.string(),
  isMock: z.boolean(),
});
export type GenerateTextResponse = z.infer<typeof GenerateTextResponseSchema>;

export const MyTextsResponseSchema = z.object({ items: z.array(TextSummarySchema) });
export type MyTextsResponse = z.infer<typeof MyTextsResponseSchema>;
