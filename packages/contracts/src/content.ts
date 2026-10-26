import { z } from 'zod';
import { CefrLevelSchema, UuidSchema } from './common.js';

export const SlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Expected a lowercase kebab-case slug');

export const TextSummarySchema = z.object({
  id: UuidSchema,
  slug: SlugSchema,
  title: z.string(),
  level: CefrLevelSchema,
  summary: z.string(),
  wordCount: z.number().int().nonnegative(),
  estimatedMinutes: z.number().int().positive(),
  topics: z.array(z.string()),
});
export type TextSummary = z.infer<typeof TextSummarySchema>;

export const TextDetailSchema = TextSummarySchema.extend({
  paragraphs: z.array(z.string()),
  author: z.string(),
  license: z.string(),
});
export type TextDetail = z.infer<typeof TextDetailSchema>;

export const ListTextsQuerySchema = z.object({
  level: CefrLevelSchema.optional(),
});
export type ListTextsQuery = z.infer<typeof ListTextsQuerySchema>;

export const ListTextsResponseSchema = z.object({
  items: z.array(TextSummarySchema),
});
export type ListTextsResponse = z.infer<typeof ListTextsResponseSchema>;

export const GlossaryEntrySchema = z.object({
  term: z.string(),
  partOfSpeech: z.string().nullable(),
  definition: z.string(),
  translation: z.string().nullable(),
  example: z.string().nullable(),
});
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

export const SlugParamSchema = z.object({ slug: SlugSchema });
