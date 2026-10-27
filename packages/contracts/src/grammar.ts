import { z } from 'zod';
import { CefrLevelSchema, UuidSchema } from './common.js';
import { SlugSchema } from './content.js';

/** Inline text run; `strong` marks emphasised fragments (e.g. the verb form being taught). */
export const TextSpanSchema = z.object({ text: z.string(), strong: z.boolean() });
export type TextSpan = z.infer<typeof TextSpanSchema>;

/** Rule explanation as structured blocks: rendered as React elements, never as raw HTML. */
export const GrammarBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heading'), text: z.string() }),
  z.object({ type: z.literal('paragraph'), spans: z.array(TextSpanSchema) }),
  z.object({ type: z.literal('list'), items: z.array(z.array(TextSpanSchema)) }),
  z.object({ type: z.literal('example'), spans: z.array(TextSpanSchema) }),
]);
export type GrammarBlock = z.infer<typeof GrammarBlockSchema>;

export const GRAMMAR_EXERCISE_KINDS = ['choice', 'gap'] as const;
export const GrammarExerciseKindSchema = z.enum(GRAMMAR_EXERCISE_KINDS);

/** An exercise as shown to the learner: the accepted answers are never included. */
export const GrammarExerciseSchema = z.object({
  id: UuidSchema,
  kind: GrammarExerciseKindSchema,
  prompt: z.string(),
  options: z.array(z.string()),
});
export type GrammarExercise = z.infer<typeof GrammarExerciseSchema>;

export const GrammarTopicProgressSchema = z.object({
  /** Exercises answered at least once. */
  attempted: z.number().int().nonnegative(),
  /** Exercises whose latest answer was correct. */
  correct: z.number().int().nonnegative(),
});
export type GrammarTopicProgress = z.infer<typeof GrammarTopicProgressSchema>;

export const GrammarTopicSummarySchema = z.object({
  id: UuidSchema,
  slug: SlugSchema,
  title: z.string(),
  level: CefrLevelSchema,
  summary: z.string(),
  exerciseCount: z.number().int().nonnegative(),
  /** Null for anonymous visitors. */
  progress: GrammarTopicProgressSchema.nullable(),
});
export type GrammarTopicSummary = z.infer<typeof GrammarTopicSummarySchema>;

export const GrammarTopicDetailSchema = GrammarTopicSummarySchema.extend({
  blocks: z.array(GrammarBlockSchema),
  exercises: z.array(GrammarExerciseSchema),
  author: z.string(),
  license: z.string(),
});
export type GrammarTopicDetail = z.infer<typeof GrammarTopicDetailSchema>;

export const ListGrammarTopicsQuerySchema = z.object({ level: CefrLevelSchema.optional() });
export type ListGrammarTopicsQuery = z.infer<typeof ListGrammarTopicsQuerySchema>;

export const ListGrammarTopicsResponseSchema = z.object({
  items: z.array(GrammarTopicSummarySchema),
});
export type ListGrammarTopicsResponse = z.infer<typeof ListGrammarTopicsResponseSchema>;

export const SubmitGrammarAnswerRequestSchema = z.object({
  answer: z.string().trim().min(1).max(200),
});
export type SubmitGrammarAnswerRequest = z.infer<typeof SubmitGrammarAnswerRequestSchema>;

export const GrammarAnswerResultSchema = z.object({
  exerciseId: UuidSchema,
  correct: z.boolean(),
  /** The canonical answer, revealed after the attempt. */
  correctAnswer: z.string(),
  explanation: z.string().nullable(),
});
export type GrammarAnswerResult = z.infer<typeof GrammarAnswerResultSchema>;
