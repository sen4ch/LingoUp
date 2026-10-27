import { z } from 'zod';

/**
 * AI task catalogue. Every task has a typed input and a structured output schema;
 * provider responses are always validated against the output schema.
 *
 * Implemented: word-explanation, reading-text-generation, exercise-generation (see AI_TASKS).
 * The others are declared so routing, quotas and provider capabilities can be designed
 * around the full list; providers report them as unsupported until implemented.
 */
export const AI_TASK_TYPES = [
  'word-explanation',
  'reading-text-generation',
  'exercise-generation',
  'grammar-explanation',
  'writing-assessment',
  'speech-recognition',
  'speech-synthesis',
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

const VocabularyTerm = z.string().min(1).max(80);

/** A short reading text built around words the learner is studying. */
export const ReadingTextGenerationInputSchema = z.object({
  level: CefrLevel,
  /** Words or phrases that must appear in the text. */
  words: z.array(VocabularyTerm).min(1),
  /** Optional theme suggested by the learner. */
  topic: z.string().max(80).nullable(),
});
export type ReadingTextGenerationInput = z.infer<typeof ReadingTextGenerationInputSchema>;

export const ReadingTextGenerationOutputSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(300),
  paragraphs: z.array(z.string().min(1).max(1500)).min(1).max(8),
});
export type ReadingTextGenerationOutput = z.infer<typeof ReadingTextGenerationOutputSchema>;

/** Gap-fill sentences: each sentence uses one word, replaced by "___". */
export const ExerciseGenerationInputSchema = z.object({
  level: CefrLevel,
  words: z
    .array(z.object({ term: VocabularyTerm, definition: z.string().max(500).nullable() }))
    .min(1)
    .max(10),
});
export type ExerciseGenerationInput = z.infer<typeof ExerciseGenerationInputSchema>;

export const GAP = '___';

export const ExerciseGenerationOutputSchema = z.object({
  items: z
    .array(
      z.object({
        term: VocabularyTerm,
        sentence: z
          .string()
          .min(5)
          .max(300)
          .refine((value) => value.includes(GAP), `The sentence must contain ${GAP}`),
        hint: z.string().max(200).nullable(),
      }),
    )
    .min(1)
    .max(10),
});
export type ExerciseGenerationOutput = z.infer<typeof ExerciseGenerationOutputSchema>;

/** How long a task may take: interactive lookups vs. longer generation. */
export type AiTaskDuration = 'interactive' | 'generation';

/** Registry of implemented tasks: input and output schemas plus execution policy. */
export const AI_TASKS = {
  'word-explanation': {
    input: WordExplanationInputSchema,
    output: WordExplanationOutputSchema,
    /** Safe to retry: no side effects, same input yields an equivalent answer. */
    idempotent: true,
    duration: 'interactive' as AiTaskDuration,
  },
  'reading-text-generation': {
    input: ReadingTextGenerationInputSchema,
    output: ReadingTextGenerationOutputSchema,
    // No side effects, but expensive: a retry would double the wait; fail fast instead.
    idempotent: false,
    duration: 'generation' as AiTaskDuration,
  },
  'exercise-generation': {
    input: ExerciseGenerationInputSchema,
    output: ExerciseGenerationOutputSchema,
    idempotent: false,
    duration: 'generation' as AiTaskDuration,
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

export function taskDuration(task: ImplementedAiTaskType): AiTaskDuration {
  return AI_TASKS[task].duration;
}
