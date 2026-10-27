import { createHash } from 'node:crypto';
import {
  AI_GENERATED_CONTENT_LICENSE,
  CefrLevelSchema,
  CONTENT_PROVENANCES,
  SlugSchema,
} from '@lingoup/contracts';
import { countWords, normalizeTerm } from '@lingoup/learning-engine';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
const HTML_TAG = /<\/?[a-z][^>]*>/i;

const GlossaryItemSchema = z.object({
  term: z.string().trim().min(1).max(80),
  partOfSpeech: z.string().trim().max(40).nullable().default(null),
  definition: z.string().trim().min(1).max(500),
  translation: z.string().trim().max(200).nullable().default(null),
  example: z.string().trim().max(300).nullable().default(null),
});

/** Bumped when stored fields change, so the importer refreshes existing rows once. */
const FORMAT_VERSION = 'v2';

const FrontmatterSchema = z
  .object({
    slug: SlugSchema,
    title: z.string().trim().min(1).max(200),
    level: CefrLevelSchema,
    summary: z.string().trim().min(1).max(500),
    topics: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
    /** Credit line shown to readers; for AI-generated texts it must not name a human author. */
    author: z.string().trim().min(1).max(200),
    provenance: z.enum(CONTENT_PROVENANCES),
    /** SPDX licence identifier. Content is accepted only with an explicit licence. */
    license: z.string().trim().min(1).max(60),
    glossary: z.array(GlossaryItemSchema).max(200).default([]),
  })
  .refine(
    (meta) => meta.provenance !== 'ai-generated' || meta.license === AI_GENERATED_CONTENT_LICENSE,
    {
      message: `AI-generated content cannot carry exclusive rights; use license ${AI_GENERATED_CONTENT_LICENSE}`,
      path: ['license'],
    },
  );

export type ContentDocument = Omit<z.infer<typeof FrontmatterSchema>, 'glossary'> & {
  paragraphs: string[];
  wordCount: number;
  contentHash: string;
  glossary: (z.infer<typeof GlossaryItemSchema> & { normalizedTerm: string })[];
};

export class ContentFormatError extends Error {
  constructor(source: string, reason: string) {
    super(`${source}: ${reason}`);
    this.name = 'ContentFormatError';
  }
}

/**
 * Parses a reading text: YAML frontmatter + plain-text paragraphs separated by blank
 * lines. HTML is rejected outright, so texts can be rendered without sanitization.
 */
export function parseContentDocument(raw: string, source: string): ContentDocument {
  const match = FRONTMATTER.exec(raw.replace(/^\uFEFF/, ''));
  if (!match) throw new ContentFormatError(source, 'missing YAML frontmatter');

  const meta = FrontmatterSchema.safeParse(parseYaml(match[1]!));
  if (!meta.success) {
    const issues = meta.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ContentFormatError(source, `invalid frontmatter (${issues})`);
  }

  const body = match[2]!;
  if (HTML_TAG.test(body)) throw new ContentFormatError(source, 'HTML is not allowed in texts');

  const paragraphs = body
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.replace(/\s*\r?\n\s*/g, ' ').trim())
    .filter((block) => block.length > 0);
  if (paragraphs.length === 0) throw new ContentFormatError(source, 'text has no paragraphs');

  const glossary = meta.data.glossary.map((item) => ({
    ...item,
    normalizedTerm: normalizeTerm(item.term),
  }));
  const seen = new Set<string>();
  for (const item of glossary) {
    if (seen.has(item.normalizedTerm)) {
      throw new ContentFormatError(source, `duplicate glossary term "${item.term}"`);
    }
    seen.add(item.normalizedTerm);
  }

  return {
    ...meta.data,
    glossary,
    paragraphs,
    wordCount: paragraphs.reduce((sum, paragraph) => sum + countWords(paragraph), 0),
    contentHash: createHash('sha256').update(FORMAT_VERSION).update(raw).digest('hex'),
  };
}
