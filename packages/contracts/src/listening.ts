import { z } from 'zod';
import { CefrLevelSchema, IsoDateTimeSchema, UuidSchema } from './common.js';

export const GenerateListeningRequestSchema = z.object({
  level: CefrLevelSchema,
  topic: z.string().trim().max(80).default('Everyday life'),
});
export type GenerateListeningRequest = z.infer<typeof GenerateListeningRequestSchema>;
export const ListeningLessonSchema = z.object({
  id: UuidSchema,
  title: z.string(),
  level: CefrLevelSchema,
  durationSeconds: z.number().min(180).max(300),
  expiresAt: IsoDateTimeSchema,
  questions: z
    .array(z.object({ question: z.string(), options: z.array(z.string()).length(4) }))
    .min(5)
    .max(8),
  isMock: z.boolean(),
});
export type ListeningLesson = z.infer<typeof ListeningLessonSchema>;
export const ListeningAnswersSchema = z.object({
  answers: z.array(z.number().int().min(0).max(3)).min(5).max(8),
});
export const ListeningResultSchema = z.object({
  correct: z.number().int(),
  total: z.number().int(),
  transcript: z.string(),
  results: z.array(
    z.object({
      correct: z.boolean(),
      answerIndex: z.number().int(),
      explanation: z.string(),
      evidence: z.string(),
    }),
  ),
});
export type ListeningResult = z.infer<typeof ListeningResultSchema>;
