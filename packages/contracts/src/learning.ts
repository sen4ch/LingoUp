import { z } from 'zod';
import { IsoDateTimeSchema } from './common.js';

export const ReadingCompletionSchema = z.object({
  textSlug: z.string(),
  completedAt: IsoDateTimeSchema,
});
export type ReadingCompletion = z.infer<typeof ReadingCompletionSchema>;

export const ReadingCompletionsResponseSchema = z.object({
  items: z.array(ReadingCompletionSchema),
});
export type ReadingCompletionsResponse = z.infer<typeof ReadingCompletionsResponseSchema>;
