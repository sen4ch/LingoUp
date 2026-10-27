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

export const CONTENT_PROVENANCES = ['human', 'ai-assisted', 'ai-generated', 'third-party'] as const;
export const ContentProvenanceSchema = z.enum(CONTENT_PROVENANCES);
export type ContentProvenance = z.infer<typeof ContentProvenanceSchema>;

/**
 * AI-generated material has no human author, so no exclusive copyright can be claimed for
 * it: it is released under CC0-1.0 and credited honestly (see content/README.md).
 */
export const AI_GENERATED_CONTENT_LICENSE = 'CC0-1.0';

export const TextDetailSchema = TextSummarySchema.extend({
  paragraphs: z.array(z.string()),
  author: z.string(),
  license: z.string(),
  provenance: ContentProvenanceSchema,
  /** True for a text visible only to its owner (e.g. generated from their vocabulary). */
  isPrivate: z.boolean(),
  /** Vocabulary terms the text was built around; highlighted by the reader. */
  focusTerms: z.array(z.string()),
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
