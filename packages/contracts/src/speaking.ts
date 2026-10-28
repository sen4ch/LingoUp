import { z } from 'zod';
import { CefrLevelSchema } from './common.js';

export const SPEAKING_AUDIO_MAX_BYTES = 1_000_000;
export const SpeakingMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(1000),
});
export type SpeakingMessage = z.infer<typeof SpeakingMessageSchema>;
export const SpeakingTurnRequestSchema = z.object({
  messages: z.array(SpeakingMessageSchema).max(20),
  level: CefrLevelSchema.optional(),
  topic: z.string().trim().max(80).default('Everyday life'),
});
export type SpeakingTurnRequest = z.infer<typeof SpeakingTurnRequestSchema>;
export const SpeakingTurnResponseSchema = z.object({
  reply: z.string().min(1).max(600),
  isMock: z.boolean(),
});
export const TranscriptionResponseSchema = z.object({ text: z.string().max(1000) });
