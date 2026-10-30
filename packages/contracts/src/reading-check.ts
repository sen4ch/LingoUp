import { z } from 'zod';
import { CefrLevelSchema, IsoDateTimeSchema, UuidSchema } from './common.js';

export const ReadingQuestionSchema = z.object({
  question: z.string().min(1).max(400),
  options: z.array(z.string().min(1).max(300)).length(4),
});
export const ReadingCheckContentSchema = z.object({
  questions: z
    .array(
      ReadingQuestionSchema.extend({
        answerIndex: z.number().int().min(0).max(3),
        explanation: z.string().min(1).max(800),
        evidence: z.string().min(1).max(1000),
      }),
    )
    .min(3)
    .max(5),
});
export const ReadingCheckResultSchema = z.object({
  correct: z.number().int().min(0).max(5),
  total: z.number().int().min(3).max(5),
  score: z.number().int().min(0).max(100),
  passed: z.boolean(),
  answeredAt: IsoDateTimeSchema,
  answers: z.array(z.number().int().min(0).max(3)).min(3).max(5),
  results: z
    .array(
      z.object({
        correct: z.boolean(),
        answerIndex: z.number().int().min(0).max(3),
        explanation: z.string(),
        evidence: z.string(),
      }),
    )
    .min(3)
    .max(5),
});
export const ReadingCheckSchema = z.object({
  id: UuidSchema,
  textSlug: z.string(),
  level: CefrLevelSchema,
  source: z.enum(['authored', 'ai']),
  questions: z.array(ReadingQuestionSchema).min(3).max(5),
  result: ReadingCheckResultSchema.nullable(),
});
export const ReadingCheckStateSchema = z.object({ check: ReadingCheckSchema.nullable() });
export const ReadingCheckAnswersSchema = z
  .object({ answers: z.array(z.number().int().min(0).max(3)).min(3).max(5) })
  .strict();
export type ReadingCheck = z.infer<typeof ReadingCheckSchema>;
export type ReadingCheckContent = z.infer<typeof ReadingCheckContentSchema>;
