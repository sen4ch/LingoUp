import { z } from 'zod';
import { UuidSchema } from './common.js';

export const ExamQuestionSchema = z.object({
  prompt: z.string(),
  options: z.array(z.string()).min(3).max(4),
  section: z.number().int().min(0).max(3),
});
export const ExamSchema = z.object({
  id: UuidSchema,
  title: z.string(),
  expiresAt: z.string(),
  reading: z.array(z.object({ title: z.string(), text: z.string() })).length(3),
  readingQuestions: z.array(ExamQuestionSchema).length(10),
  listeningQuestions: z.array(ExamQuestionSchema).length(10),
  writingTasks: z.array(z.string()).length(2),
  speakingTasks: z.array(z.string()).length(3),
});
export const ExamAnswersSchema = z.object({
  reading: z.array(z.number().int().min(0).max(3)).length(10),
  listening: z.array(z.number().int().min(0).max(3)).length(10),
  writing: z.tuple([z.string().trim().min(1).max(4000), z.string().trim().min(1).max(6000)]),
  speaking: z.array(z.string().trim().min(1).max(1000)).length(3),
});
const ReviewSchema = z.object({
  band: z.number().min(0).max(9),
  feedback: z.string().min(1).max(1500),
});
export const ExamResultSchema = z.object({
  id: UuidSchema,
  completedAt: z.string(),
  score: z.number().int().min(0).max(100).nullable(),
  reading: z.number().int().min(0).max(10),
  listening: z.number().int().min(0).max(10),
  readingAnswers: z.array(z.number().int().min(0).max(3)).length(10),
  listeningAnswers: z.array(z.number().int().min(0).max(3)).length(10),
  writingTask1: ReviewSchema,
  writingTask2: ReviewSchema,
  writingBand: z.number().min(0).max(9),
  speakingLanguage: ReviewSchema,
  isMock: z.boolean(),
  listeningTranscripts: z.array(z.string()).length(4),
});
export const ExamSessionSchema = z.object({
  exam: ExamSchema,
  result: ExamResultSchema.nullable(),
});
export type Exam = z.infer<typeof ExamSchema>;
export type ExamAnswers = z.infer<typeof ExamAnswersSchema>;
export type ExamResult = z.infer<typeof ExamResultSchema>;
