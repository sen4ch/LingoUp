import { z } from 'zod';

/**
 * AI task catalogue. Every task has a typed input and a structured output schema;
 * provider responses are always validated against the output schema.
 *
 * Only `word-explanation` has an executor today. The others are declared so routing,
 * quotas and provider capabilities can be designed around the full list, and providers
 * report them as unsupported until implemented.
 */
export const AI_TASK_TYPES = [
  'word-explanation',
  'grammar-explanation',
  'writing-assessment',
  'speech-recognition',
  'speech-synthesis',
  'exercise-generation',
  'learning-recommendation',
] as const;
export const AiTaskTypeSchema = z.enum(AI_TASK_TYPES);
export type AiTaskType = z.infer<typeof AiTaskTypeSchema>;

const CefrLevel = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

export const WordExplanationInputSchema = z.object({
  term: z.string().min(1).max(80),
  context: z.string().max(600),
  learnerLevel: CefrLevel,
  /** ISO 639-1 code of the language for the translation. */
  nativeLanguage: z.string().length(2),
});
export type WordExplanationInput = z.infer<typeof WordExplanationInputSchema>;

export const WordExplanationOutputSchema = z.object({
  definition: z.string().min(1).max(500),
  translation: z.string().max(200).nullable(),
  partOfSpeech: z.string().max(40).nullable(),
  example: z.string().max(300).nullable(),
  usageNote: z.string().max(300).nullable(),
});
export type WordExplanationOutput = z.infer<typeof WordExplanationOutputSchema>;

/** Registry of implemented tasks: input and output schemas plus execution policy. */
export const AI_TASKS = {
  'word-explanation': {
    input: WordExplanationInputSchema,
    output: WordExplanationOutputSchema,
    /** Safe to retry: no side effects, same input yields an equivalent answer. */
    idempotent: true,
  },
} as const;

export type ImplementedAiTaskType = keyof typeof AI_TASKS;
export type AiTaskInput<T extends ImplementedAiTaskType> = z.infer<(typeof AI_TASKS)[T]['input']>;
export type AiTaskOutput<T extends ImplementedAiTaskType> = z.infer<(typeof AI_TASKS)[T]['output']>;

export interface AiTaskResult<T extends ImplementedAiTaskType> {
  provider: string;
  model: string;
  output: AiTaskOutput<T>;
}

/** Safe to retry after a transient failure. */
export function isIdempotentTask(task: ImplementedAiTaskType): boolean {
  return AI_TASKS[task].idempotent;
}

export function isImplementedTask(task: AiTaskType): task is ImplementedAiTaskType {
  return Object.hasOwn(AI_TASKS, task);
}
