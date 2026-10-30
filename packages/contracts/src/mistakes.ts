import { z } from 'zod';
import { IsoDateTimeSchema, PageQuerySchema, UuidSchema } from './common.js';
import { WritingIssueSchema } from './writing.js';

export const MistakeSourceSchema = z.enum(['writing', 'grammar', 'speaking']);
export const MistakeEntrySchema = z.object({
  id: UuidSchema,
  source: MistakeSourceSchema,
  category: WritingIssueSchema.shape.category,
  errorType: z.string().max(40).nullable(),
  original: z.string().max(4000),
  corrected: z.string().max(4000),
  explanation: z.string().max(1000),
  example: z.string().max(600).nullable(),
  alternatives: WritingIssueSchema.shape.alternatives.unwrap(),
  context: z.string().max(1000),
  sourceHref: z.string().max(300).startsWith('/'),
  createdAt: IsoDateTimeSchema,
  resolvedAt: IsoDateTimeSchema.nullable(),
});
export type MistakeEntry = z.infer<typeof MistakeEntrySchema>;
export const MistakeQuerySchema = PageQuerySchema.extend({
  source: MistakeSourceSchema.optional(),
  status: z.enum(['open', 'resolved', 'all']).default('open'),
  category: WritingIssueSchema.shape.category.optional(),
});
export type MistakeQuery = z.infer<typeof MistakeQuerySchema>;
export const MistakeListSchema = z.object({
  items: z.array(MistakeEntrySchema),
  nextCursor: UuidSchema.nullable(),
  counts: z.object({
    open: z.number().int().nonnegative(),
    resolved: z.number().int().nonnegative(),
  }),
});
export const UpdateMistakeSchema = z.object({ resolved: z.boolean() }).strict();
