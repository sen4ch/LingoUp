import { z } from 'zod';
import { CefrLevelSchema } from './common.js';

export const WritingMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});
export const WritingTurnRequestSchema = z
  .object({
    level: CefrLevelSchema.optional(),
    topic: z.string().trim().min(1).max(80).default('Everyday life'),
    messages: z.array(WritingMessageSchema).max(20),
  })
  .refine(
    ({ messages }) =>
      messages.every(
        (message, index) => message.role === (index % 2 === 0 ? 'assistant' : 'user'),
      ) && messages.length % 2 === 0,
    'Provide alternating emails ending with your reply',
  )
  .refine(
    ({ messages }) =>
      messages.reduce((total, message) => total + message.content.length, 0) <= 14000,
    'Email context is too long',
  );
export const WritingIssueSchema = z.object({
  quote: z.string().min(1).max(4000),
  occurrence: z.number().int().min(0).max(4000),
  start: z.number().int().min(0).max(8000).nullable().optional(),
  end: z.number().int().min(0).max(8000).nullable().optional(),
  category: z.enum(['word', 'grammar', 'suggestion']),
  errorType: z
    .enum([
      'sentence_structure',
      'word_order',
      'sentence_connection',
      'verb_tense',
      'punctuation',
      'agreement',
      'articles',
      'word_form',
      'spelling',
      'word_choice',
      'naturalness',
      'ambiguity',
    ])
    .nullable()
    .optional(),
  replacement: z.string().max(4000),
  explanation: z.string().min(1).max(600),
  example: z.string().min(1).max(600).nullable().optional(),
  alternatives: z
    .array(
      z.object({ replacement: z.string().min(1).max(4000), meaning: z.string().min(1).max(600) }),
    )
    .max(3)
    .optional(),
});
export const WritingOutputSchema = z.object({
  subject: z.string().min(1).max(120),
  reply: z.string().min(1).max(4000),
  feedback: z.string().min(1).max(1000),
  issues: z.array(WritingIssueSchema).max(50),
  correctedText: z.string().min(1).max(6000).nullable().optional(),
  needsClarification: z.boolean().optional(),
});
export const WritingTurnResponseSchema = WritingOutputSchema.extend({ isMock: z.boolean() });
export type WritingMessage = z.infer<typeof WritingMessageSchema>;
export type WritingIssue = z.infer<typeof WritingIssueSchema>;
export type WritingTurnRequest = z.infer<typeof WritingTurnRequestSchema>;
export type WritingTurnResponse = z.infer<typeof WritingTurnResponseSchema>;
