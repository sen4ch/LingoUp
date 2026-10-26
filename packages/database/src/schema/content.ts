import { sql } from 'drizzle-orm';
import { check, index, integer, pgSchema, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { CEFR_LEVEL_CHECK, createdAt, primaryId, timestamptz, updatedAt } from './_columns.js';

/** Owned by the Content module. Holds no personal data. */
export const contentSchema = pgSchema('content');

export const texts = contentSchema.table(
  'texts',
  {
    id: primaryId(),
    slug: text('slug').notNull().unique('texts_slug_key'),
    title: text('title').notNull(),
    level: text('level').notNull(),
    summary: text('summary').notNull(),
    /** Plain-text paragraphs; HTML is rejected on import. */
    paragraphs: text('paragraphs').array().notNull(),
    topics: text('topics')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    wordCount: integer('word_count').notNull(),
    author: text('author').notNull(),
    /** SPDX identifier of the content licence, e.g. CC-BY-4.0. */
    license: text('license').notNull(),
    /** SHA-256 of the source file; lets the importer skip unchanged texts. */
    contentHash: text('content_hash').notNull(),
    publishedAt: timestamptz('published_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('texts_level', sql`${t.level} ${CEFR_LEVEL_CHECK}`),
    check('texts_word_count', sql`${t.wordCount} >= 0`),
    index('texts_level_published_idx').on(t.level, t.publishedAt),
  ],
);

export const glossaryEntries = contentSchema.table(
  'glossary_entries',
  {
    id: primaryId(),
    textId: uuid('text_id')
      .notNull()
      .references(() => texts.id, { onDelete: 'cascade' }),
    term: text('term').notNull(),
    /** Normalized with learning-engine `normalizeTerm`. */
    normalizedTerm: text('normalized_term').notNull(),
    partOfSpeech: text('part_of_speech'),
    definition: text('definition').notNull(),
    translation: text('translation'),
    example: text('example'),
  },
  (t) => [uniqueIndex('glossary_entries_text_term_key').on(t.textId, t.normalizedTerm)],
);
